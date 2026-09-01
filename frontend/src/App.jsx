import { Routes, Route, Link } from 'react-router-dom';

// Milestone 1: skeleton only. Real pages, auth context, and API client
// are added in milestones 2 and onward.
export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/">Restaurant Orders</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<p>Welcome. Login, auth, and the rest come in milestone 2.</p>} />
          <Route path="*" element={<p>Not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
