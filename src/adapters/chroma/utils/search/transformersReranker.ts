/**
 * Transformers-based reranker using @eidentic/transformers LocalReranker.
 * Provides cross-encoder reranking for improved candidate ranking in RAG queries.
 *
 * Uses: cross-encoder/ms-marco-MiniLM-L-6-v2 via LocalReranker from @eidentic/transformers
 * Load pattern: Lazy singleton initialization per session
 * Error handling: Timeout and fallback to hybrid ranking supported
 */

import type { LocalReranker } from "@eidentic/transformers" with { "resolution-mode": "import" };

export interface RerankCandidate {
  id: string;
  text: string;
  score: number;
}

export interface RerankResult extends RerankCandidate {
  rerankScore?: number;
}

class TransformersRerankerSingleton {
  private static instance: LocalReranker | null = null;
  private static loadPromise: Promise<LocalReranker> | null = null;
  private static loadStartTime: number | null = null;

  /**
   * Load the LocalReranker model.
   * First call downloads the model; subsequent calls return cached instance.
   * @returns Promise resolving to LocalReranker instance
   * @throws Error if model download/initialization fails
   */
  static async load(): Promise<LocalReranker> {
    if (this.instance) {
      return this.instance;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadStartTime = Date.now();

    this.loadPromise = (async () => {
      try {
        // Lazy import to avoid requiring @eidentic/transformers at extension startup
        const { LocalReranker } = await import("@eidentic/transformers");
        const reranker = await LocalReranker.load();
        const loadTime = Date.now() - (this.loadStartTime || 0);
        console.log(
          `[RerankerSingleton] LocalReranker loaded successfully (${loadTime}ms)`
        );
        this.instance = reranker;
        return reranker;
      } catch (error) {
        console.error("[RerankerSingleton] Failed to load LocalReranker:", error);
        this.loadPromise = null;
        throw error;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Rerank candidates using cross-encoder model.
   *
   * @param queryText The query text to rerank against
   * @param candidates Array of candidates with id, text, score
   * @param timeoutMs Timeout for reranking operation (default: 5000ms)
   * @returns Promise<RerankResult[]> Candidates sorted by reranker score (descending)
   * @throws Error if timeout or reranking fails (caller should fallback to hybrid ranking)
   */
  static async rerank(
    queryText: string,
    candidates: RerankCandidate[],
    timeoutMs: number = 5000
  ): Promise<RerankResult[]> {
    if (!queryText || !candidates || candidates.length === 0) {
      return candidates as RerankResult[];
    }

    const startTime = Date.now();

    try {
      // Load with timeout protection
      const loadPromise = this.load();
      const loadTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Reranker load timeout after ${timeoutMs}ms`
              )
            ),
          timeoutMs / 2
        )
      );

      const reranker = await Promise.race([
        loadPromise,
        loadTimeoutPromise,
      ]);

      // Rerank with timeout protection
      const rerankTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Reranking timeout after ${timeoutMs}ms`
              )
            ),
          timeoutMs
        )
      );

      const reranked = await Promise.race([
        reranker.rerank(queryText, candidates),
        rerankTimeoutPromise,
      ]);

      const elapsedTime = Date.now() - startTime;
      console.log(
        `[RerankerSingleton] Reranked ${candidates.length} candidates in ${elapsedTime}ms`
      );

      // Add rerankScore to results
      return reranked.map((result: RerankCandidate) => ({
        ...result,
        rerankScore: result.score,
      }));
    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(
        `[RerankerSingleton] Reranking failed after ${elapsedTime}ms:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Reset singleton state.
   * Useful for testing or reloading the model.
   */
  static reset(): void {
    this.instance = null;
    this.loadPromise = null;
    this.loadStartTime = null;
  }

  /**
   * Check if model is currently loaded.
   */
  static isLoaded(): boolean {
    return this.instance !== null;
  }
}

export default TransformersRerankerSingleton;
