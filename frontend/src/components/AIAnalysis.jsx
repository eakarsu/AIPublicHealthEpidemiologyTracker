import ReactMarkdown from 'react-markdown';

export default function AIAnalysis({ content, loading }) {
  if (loading) {
    return (
      <div className="ai-analysis">
        <div className="ai-analysis-header">
          <div className="ai-icon">🤖</div>
          <div>
            <h3>AI Analysis in Progress</h3>
            <p>Powered by OpenRouter AI</p>
          </div>
        </div>
        <div className="loading">
          <div className="loading-spinner"></div>
          Analyzing data with AI...
        </div>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="ai-analysis">
      <div className="ai-analysis-header">
        <div className="ai-icon">🤖</div>
        <div>
          <h3>AI Analysis Results</h3>
          <p>Powered by OpenRouter AI</p>
        </div>
      </div>
      <div className="ai-analysis-content">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
