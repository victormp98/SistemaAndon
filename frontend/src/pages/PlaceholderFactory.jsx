const PlaceholderPage = ({ title, description }) => (
  <div className="placeholder-page">
    <div className="card">
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="status-badge warning">Pendiente de Implementar</div>
    </div>
  </div>
);

export default PlaceholderPage;
