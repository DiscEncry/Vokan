// Utility to format AI-generated word details (markdown-like) to HTML for display
export function formatWordDetails(detailsText: string): string {
  let html = detailsText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/([*_])(.*?)\1/g, '<em>$2</em>');
  html = html.replace(/^\s*[-*]\s+(.*)/gm, '<li>$1</li>');
  html = html.replace(/<\/li>\n<li>/g, '</li><li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  return html;
}
