import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Printer, ShieldCheck, ArrowRight, Mail, Lock, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const { login, loginWithEmail, signUp, user } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vul a.u.b. alle velden in.');
      return;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let message = 'Er is een fout opgetreden.';
      
      if (err.code === 'auth/operation-not-allowed') {
        message = 'E-mail/wachtwoord login is niet ingeschakeld in de Firebase Console.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        message = 'Onjuist e-mailadres of wachtwoord. Als u nog geen account heeft, kies dan voor "Registreren".';
      } else if (err.code === 'auth/wrong-password') {
        message = 'Onjuist wachtwoord.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'Dit e-mailadres is al in gebruik.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Wachtwoord moet minimaal 6 tekens bevatten.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Te veel mislukte pogingen. Probeer het later opnieuw.';
      }
      
      setError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans">
      {/* Left Side: Illustration & Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
           <div className="absolute top-0 -left-20 w-80 h-80 bg-blue-500 rounded-full blur-[100px]"></div>
           <div className="absolute bottom-0 -right-20 w-80 h-80 bg-indigo-500 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Printer className="text-white w-6 h-6" />
            </div>
            <span className="text-white font-black text-2xl tracking-tighter">Pixia Service Manager</span>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-md"
          >
            <h1 className="text-5xl font-black text-white leading-tight mb-6">
              Beheer uw service <br/>
              <span className="text-blue-500">zonder frictie.</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Het centrale hub voor printerservice, machine-onderhoud en voorraadbeheer voor grootformaat specialisten.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-8">
           <div className="space-y-2">
             <div className="text-blue-500 font-black text-2xl">01</div>
             <p className="text-white font-bold text-sm">Interventies</p>
             <p className="text-slate-500 text-xs">Plan en beheer storingen en onderhoud in real-time.</p>
           </div>
           <div className="space-y-2">
             <div className="text-blue-500 font-black text-2xl">02</div>
             <p className="text-white font-bold text-sm">Werkbonnen</p>
             <p className="text-slate-500 text-xs">Digitale handtekeningen en automatische archivering.</p>
           </div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24 bg-white">
        <div className="max-w-sm w-full space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-8">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <Printer className="text-white w-10 h-10" />
                </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">
              {isSignUp ? 'Maak een account' : 'Medewerker Portaal'}
            </h2>
            <p className="text-slate-500 font-medium">
              {isSignUp ? 'Vul uw gegevens in om te registreren.' : 'Log in om toegang te krijgen tot uw dashboard.'}
            </p>
          </div>

          <form onSubmit={handleEmailAction} className="space-y-5">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mailadres</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="technicus@pixia.nl"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Wachtwoord</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 transition-all font-black uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed group shadow-xl shadow-slate-900/10 active:scale-[0.98]"
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{isSignUp ? 'Registreren' : 'Inloggen met E-mail'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center">
              <button 
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
              >
                {isSignUp ? 'Heeft u al een account? Log in' : 'Nog geen account? Registreer hier'}
              </button>
            </div>
          </form>

          <div className="relative py-4">
             <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
             </div>
             <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span className="bg-white px-4 italic">Of ga verder met</span>
             </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={login}
              className="w-full flex items-center justify-between px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-slate-50 transition-all group shadow-sm active:scale-[0.98]"
            >
              <div className="flex items-center gap-4 text-slate-700 font-bold">
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                <span>Google Medewerker Login</span>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </button>

            <div className="pt-8 space-y-6">
               <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-[11px] text-slate-500 font-medium leading-tight">
                    Toegang is uitsluitend voor geautoriseerde technici en beheerders van Pixia Service Manager.
                  </p>
               </div>
            </div>
          </div>

          <div className="text-center lg:text-left pt-12">
             <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
               &copy; 2026 Pixia Service Manager • Versie 1.0.0
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
