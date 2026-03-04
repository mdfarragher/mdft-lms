import { useState, useEffect } from "preact/hooks";

interface SearchResult {
  type: "course" | "module" | "lesson";
  title: string;
  link: string;
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    setHasSearched(true);
    setResults([]);
    setError(null);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Search failed. Please try again.");
        console.error("Search failed", res.status, errData);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (query.trim()) {
      performSearch(query);
    }
  };

  return (
    <div class="w-full max-w-2xl mx-auto mt-8">
      <form onSubmit={handleSubmit} class="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Search for courses, modules, or lessons..."
          class="flex-1 px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          class="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {hasSearched && (
        <div class="space-y-4">
          {error ? (
            <div class="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-center">
              {error}
            </div>
          ) : loading ? (
            <div class="text-center py-8 text-gray-500">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : results.length > 0 ? (
            <div class="bg-white rounded-lg shadow border border-gray-200 divide-y divide-gray-100">
              {results.map((result, index) => (
                <a
                  key={index}
                  href={result.link}
                  class="block p-4 hover:bg-gray-50 transition-colors group"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                        {result.title}
                      </h3>
                      <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1 inline-block bg-gray-100 px-2 py-0.5 rounded">
                        {result.type}
                      </span>
                    </div>
                    <span class="text-gray-400 group-hover:text-blue-500">
                      &rarr;
                    </span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div class="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
