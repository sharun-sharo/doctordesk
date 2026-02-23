import { Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

export default function Drawer({ open, onClose, title, children, width = 'max-w-md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

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
          <div className="fixed inset-0 bg-slate-900/40" aria-hidden="true" />
        </Transition.Child>
        <div className="fixed inset-0 flex justify-end">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="ease-in duration-150"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <Dialog.Panel
              className={`w-full ${width} h-full flex flex-col rounded-l-2xl border-l border-slate-200 bg-white shadow-xl`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                {title && (
                  <Dialog.Title className="text-h2 text-content">
                    {title}
                  </Dialog.Title>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-content-muted transition-colors hover:bg-slate-100 hover:text-content focus:outline-none focus:ring-2 focus:ring-[#0EA5A4] focus:ring-offset-2"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
