/**
 * Test harness for admin popovers on phone-sized viewports.
 *
 * The admin header sits behind an auth guard, so a smoke test cannot reach the
 * real page. The bug these tests cover is purely geometric, though: a dropdown
 * anchored to a toolbar button in the middle of the header, wider than the room
 * left of it, used to run off the edge of the screen. This mounts the real
 * NotificationBell inside a header of the same shape so the positioning code
 * under test is the shipped code.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import React from 'react';
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ExternalLink, Eye, Inbox, Menu, Search } from 'lucide-react';
import NotificationBell from '../../src/components/admin/NotificationBell';

function Harness() {
  return (
    <MemoryRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <button className="lg:hidden text-slate-500" aria-label="Open sidebar">
              <Menu className="w-6 h-6" />
            </button>

            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg"
              aria-label="Open search"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>

            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 ml-auto">
              <button className="p-2 text-slate-600" aria-label="Toggle privacy mode">
                <Eye className="w-5 h-5" />
              </button>
              <NotificationBell />
              <span className="p-2 text-slate-600">
                <Inbox className="w-5 h-5" />
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap p-2 sm:p-0 text-sm text-slate-600">
                <span className="hidden sm:inline">View Website →</span>
                <ExternalLink className="w-5 h-5 sm:hidden" aria-hidden="true" />
              </span>
            </div>
          </div>
        </header>

        <main className="p-4">
          <div className="h-[200vh] rounded-xl border border-slate-200 bg-white" />
        </main>
      </div>
    </MemoryRouter>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
