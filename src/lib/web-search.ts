export type SearchResult = {
  title: string
  url: string
  content: string
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 3,
        search_depth: 'basic',
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []) as SearchResult[]
  } catch {
    return []
  }
}
