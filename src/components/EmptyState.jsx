export default function EmptyState({ icon: Icon, title, description, buttonText, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl animate-in zoom-in-95 duration-500">
      <div className="bg-slate-800 p-6 rounded-full border border-slate-700 shadow-xl mb-6 text-slate-400">
        <Icon className="w-12 h-12 stroke-[1.5]" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 max-w-sm mb-8">{description}</p>
      
      <button 
        onClick={onAction}
        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
      >
        {buttonText}
      </button>
    </div>
  );
}
