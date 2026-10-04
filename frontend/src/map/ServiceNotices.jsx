import PropTypes from 'prop-types';

export default function ServiceNotices({ notices, error }) {
  return <section className="notices" aria-label="Campus service notices"><h2>Service notices</h2>
    {error ? <p role="status" className="muted">Service notices are unavailable.</p> : notices.length ? notices.map((notice) => <article key={notice.id} className={`notice ${notice.severity}`}><strong>{notice.title}</strong><p>{notice.message}</p><small>{notice.severity} · until {new Date(notice.activeUntil).toLocaleString()}</small></article>) : <p className="muted">No active service notices.</p>}
  </section>;
}
ServiceNotices.propTypes = { notices: PropTypes.array.isRequired, error: PropTypes.string };
