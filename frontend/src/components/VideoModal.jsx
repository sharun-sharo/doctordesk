import { Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

export default function VideoModal({ open, onClose, videoSrc = '', posterSrc = '', title = 'Product demo' }) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm" aria-hidden="true" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-4xl rounded-2xl bg-slate-900 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80">
                <Dialog.Title className="text-sm font-medium text-white">{title}</Dialog.Title>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="aspect-video bg-black">
                {videoSrc ? (
                  <video
                    src={videoSrc}
                    poster={posterSrc || undefined}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                    playsInline
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-800/80 px-6">
                    <p className="text-sm font-medium text-slate-300">No demo video yet</p>
                    <p className="text-xs text-center max-w-sm">Add <code className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">demo.mp4</code> to <code className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">frontend/public/</code> and set <code className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">DEMO_VIDEO_SRC</code> in <code className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">Login.jsx</code>.</p>
                  </div>
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
