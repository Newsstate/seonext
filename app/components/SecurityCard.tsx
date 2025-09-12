'use client';
export default function SecurityCard({ data }:{ data:any }) {
  const s = data?.http?.security || {};
  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-semibold">Security Headers</h3>
      <div className="kv">
        <div className="k">HTTPS</div><div className="v">{data?.http?.scheme === 'https' ? 'Yes' : 'No'}</div>
        <div className="k">HSTS</div><div className="v">{s.hsts || <i>—</i>}</div>
        <div className="k">CSP</div><div className="v">{s.csp ? 'Present' : <i>—</i>}</div>
        <div className="k">X-Frame-Options</div><div className="v">{s.xFrameOptions || <i>—</i>}</div>
        <div className="k">X-Content-Type-Options</div><div className="v">{s.xContentTypeOptions || <i>—</i>}</div>
        <div className="k">Referrer-Policy</div><div className="v">{s.referrerPolicy || <i>—</i>}</div>
        <div className="k">Permissions-Policy</div><div className="v">{s.permissionsPolicy || <i>—</i>}</div>
      </div>
    </div>
  );
}
