import React, { useState } from 'react';
import { 
  Truck, Lock, ArrowRight, AlertCircle, 
  User, Eye, EyeOff, ArrowLeft
} from 'lucide-react';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';

export default function DeliveryLoginPage() {
  const { login, authError, setAuthError } = useDeliveryAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (setAuthError) setAuthError(null);
    setIsSubmitting(true);

    try {
      const res = await login(username, password);
      setIsSubmitting(false);
      if (!res.success) {
        setLocalError(res.error || 'Authentication rejected. Invalid credentials.');
      }
    } catch {
      setIsSubmitting(false);
      setLocalError('Authentication service unreachable.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-[#070d18] to-slate-950 text-slate-100 flex items-center justify-center px-4 py-8 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10">
        
        {/* Top Header Label */}
        <div className="flex items-center justify-between">
          <a 
            href="https://cu-store-mu.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Student Storefront</span>
          </a>
          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Delivery Fleet
          </span>
        </div>

        {/* Portal Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl p-0.5 shadow-xl mx-auto flex items-center justify-center bg-gradient-to-tr from-emerald-500 via-teal-400 to-purple-600 shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
              <Truck className="w-7 h-7" />
            </div>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            Delivery Executives Portal
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Chandigarh University Hostel Fleet • Room Drops & Real-Time Orders
          </p>
        </div>

        {/* Error Alert */}
        {(localError || authError) && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-400 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{localError || authError}</span>
          </div>
        )}

        {/* Credential Login Form (No auto-login) */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Executive Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter executive username"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 font-medium"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-10 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-xl shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer mt-1"
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Sign In as Delivery Executive'}</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </form>

        <div className="text-center pt-1 border-t border-slate-800/80">
          <p className="text-[11px] text-slate-500">
            Dedicated portal for Chandigarh University Store delivery executives.
          </p>
        </div>
      </div>
    </div>
  );
}
