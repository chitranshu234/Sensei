import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { RepositoryPage } from './pages/RepositoryPage';

export const App = () => {
  return (
    <div className="min-h-screen bg-surface-200 text-surface-900 font-sans antialiased selection:bg-primary-500/30 selection:text-surface-900 flex flex-col">
      {/* ─── Ambient Atmospheric Lighting Mesh ─── */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Soft violet/indigo top-left glow */}
        <div className="absolute -top-32 -left-32 h-[650px] w-[650px] rounded-full bg-primary-600/12 blur-[140px]" />
        {/* Warm amber top-right subtle glow */}
        <div className="absolute -top-40 right-10 h-[500px] w-[500px] rounded-full bg-accent-amber/6 blur-[150px]" />
        {/* Cyan center-depth glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[550px] w-[550px] rounded-full bg-accent-cyan/5 blur-[120px]" />
        {/* Violet bottom-right accent */}
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-accent-violet/8 blur-[140px]" />
      </div>

      <Navbar />

      <main className="flex-1 w-full">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/repo/:id" element={<RepositoryPage />} />
        </Routes>
      </main>

      {/* Global Footer */}
      <footer className="w-full py-4 border-t border-surface-300 bg-white/60 backdrop-blur-md mt-auto">
        <div className="max-w-[1700px] mx-auto px-6 text-center">
          <p className="text-xs sm:text-sm font-medium text-surface-600">
            Made by <span className="font-bold text-primary-600">Chitranshu Pandey</span>
          </p>
        </div>
      </footer>
    </div>
  );
};
