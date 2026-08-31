import { Mail, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VerifyEmail() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-10 rounded-3xl shadow-2xl text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-500/20 p-5 rounded-full border border-indigo-500/30">
            <Mail className="w-10 h-10 text-indigo-400" />
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-white mb-4">Check Your Email</h2>
        
        <p className="text-slate-300 mb-8 leading-relaxed">
          We've sent a verification link to your email address. Please click the link to verify your account and get started with Invovo ERP.
        </p>

        <div className="pt-6 border-t border-slate-700">
          <p className="text-sm text-slate-400 mb-4">
            Already verified?
          </p>
          <Link 
            to="/login" 
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            Continue to Login
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
