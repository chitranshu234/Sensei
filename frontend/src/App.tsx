import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { AuthGate } from './components/AuthGate';
import { Dashboard } from './pages/Dashboard';
import { RepositoryPage } from './pages/RepositoryPage';

export const App = () => {
  return (
    <AuthGate>
      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="relative z-10 flex-1 w-full pt-14">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/repo/:id" element={<RepositoryPage />} />
            <Route path="/oauth2/callback" element={<Dashboard />} />
          </Routes>
        </main>

        <footer className="relative z-10 border-t border-paper-400 bg-paper-50/80 py-3 mt-auto">
          <div className="mx-auto max-w-[1700px] px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2">
            <p className="annotation normal-case tracking-normal">
              Built by <span className="font-semibold text-ink-700">Chitranshu Pandey</span>
            </p>
            <p className="annotation">Spring Boot · FastAPI · React</p>
          </div>
        </footer>
      </div>
    </AuthGate>
  );
};
