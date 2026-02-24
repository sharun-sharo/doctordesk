import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import FormInput from '../components/ui/FormInput';
import Logo from '../components/ui/Logo';
import {
  Check,
  Users,
  Calendar,
  FileText,
  CreditCard,
  UserCircle,
  Cloud,
  Phone,
  ArrowRight,
  Heart,
  ShieldCheck,
  Server,
  Database,
  ChevronDown,
  Eye,
  EyeOff,
  Star,
  Sparkles,
} from 'lucide-react';

const DEMO_PHONE = 'tel:+919566551345';
// Demo video: put your file in frontend/public/ (e.g. demo.mp4), then set:
const DEMO_VIDEO_SRC = ''; // e.g. '/demo.mp4'
const DEMO_VIDEO_POSTER = ''; // optional: e.g. '/demo-poster.jpg' – thumbnail before play

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#security', label: 'Security' },
  { href: '#contact', label: 'Contact' },
];

const PRICING_INCLUDES = [
  '1 Doctor Login',
  '1 Receptionist Login',
  'Full access for 30 days',
  'No hidden charges',
];

const FEATURES = [
  { icon: Users, title: 'One place for every patient', desc: 'Spend less time hunting for files. Get a single, searchable record per patient and clearer outcomes.' },
  { icon: Calendar, title: 'Schedule that actually works', desc: 'Fewer no-shows and double-bookings. List and calendar views plus reminders so your day runs smoothly.' },
  { icon: FileText, title: 'Prescriptions in seconds', desc: 'Create and send prescriptions fast. Attach notes and files so follow-ups are straightforward.' },
  { icon: CreditCard, title: 'Get paid without the hassle', desc: 'Invoices and payments in one view. See revenue at a glance and keep cash flow predictable.' },
  { icon: UserCircle, title: 'Right access for each role', desc: 'Doctors and receptionists see only what they need. Fewer mistakes, better teamwork.' },
  { icon: Sparkles, title: 'AI insights', desc: 'Smart summaries on revenue, workload, and patient trends. Get actionable tips so you can focus on what matters most.' },
];

const SECURITY_ITEMS = [
  { icon: ShieldCheck, title: 'Secure & encrypted', desc: 'Data encrypted in transit and at rest. We take your clinic’s security seriously.' },
  { icon: Cloud, title: 'Cloud-based', desc: 'Access from anywhere. No servers to maintain and automatic backups.' },
  { icon: Server, title: 'Reliable uptime', desc: 'Built for daily use. We monitor and maintain so you can focus on patients.' },
  { icon: Database, title: 'Data privacy focused', desc: 'Your data stays yours. We follow strict privacy practices and don’t sell your information.' },
];

const TESTIMONIALS = [
  { name: 'Dr. Priya Sharma', clinic: 'City Care Clinic', quote: 'Finally, one system for the whole clinic. We stopped losing appointments and our front desk actually enjoys coming to work.', initials: 'PS' },
  { name: 'Raj Mehta', clinic: 'Family Health Centre', quote: 'Billing used to take hours. Now we see everything in one place and get paid faster.', initials: 'RM' },
  { name: 'Dr. Anil Kumar', clinic: 'Metro Polyclinic', quote: 'Prescriptions and patient history in one click. My consultations are smoother and patients notice.', initials: 'AK' },
];

const HERO_TRUST = {
  quote: 'One place for patients and billing. We stopped losing appointments.',
  name: 'Dr. Priya Sharma',
  clinic: 'City Care Clinic',
  stars: 5,
};

const CLINIC_LOGOS = ['City Care', 'Family Health', 'Metro Poly', 'Care Plus', 'Health First'];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validateEmail = (value) => {
    if (!value.trim()) return 'Email is required';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(value.trim())) return 'Please enter a valid email address';
    return '';
  };

  const validatePassword = (value) => {
    if (!value) return 'Password is required';
    return '';
  };

  const handleEmailBlur = () => setEmailError(validateEmail(email));
  const handlePasswordBlur = () => setPasswordError(validatePassword(password));

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      setSubmitError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] login-page-bg">
      {/* Sticky nav */}
      <nav
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          navScrolled ? 'bg-white/95 backdrop-blur-lg border-b border-slate-200/80 shadow-sm shadow-slate-200/50' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 rounded-lg py-2 -my-2 transition-opacity hover:opacity-90" aria-label="DoctorDesk home">
            <Logo className="text-xl sm:text-2xl" />
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="group relative px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-lg hover:bg-slate-100/80"
              >
                <span className="relative z-10">{label}</span>
                <span className="absolute bottom-1.5 left-4 right-4 h-0.5 bg-primary-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-full" aria-hidden />
              </a>
            ))}
          </div>
          <a
            href={DEMO_PHONE}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all duration-200 ease-out hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.99] hover:shadow-xl hover:shadow-primary-500/30 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-label="Start free trial"
          >
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </nav>

      <div className="lg:grid lg:grid-cols-[1fr,minmax(380px,28rem)] lg:min-h-[calc(100dvh-4rem)]">
        {/* Left: Landing content – hero full-width, then constrained */}
        <div className="px-4 py-10 sm:px-6 sm:py-12 lg:px-10 lg:py-14 xl:px-16 overflow-y-auto pb-[max(2rem,env(safe-area-inset-bottom))] flex flex-col">
          {/* Hero – full width of column */}
          <section className="relative mb-12 sm:mb-16 lg:mb-20 rounded-2xl lg:rounded-3xl overflow-hidden min-h-[360px] sm:min-h-[420px] flex flex-col justify-end border border-slate-200/50 shadow-xl shadow-slate-200/30">
            {/* Base: deep slate + soft teal-to-slate gradient */}
            <div className="absolute inset-0 hero-gradient" />
            {/* Soft teal radial accents for depth */}
            <div className="absolute inset-0 hero-glow-teal" aria-hidden />
            {/* Subtle blur radial highlights */}
            <div className="absolute inset-0 hero-glow-highlight" aria-hidden />
            {/* Light dark overlay for headline contrast */}
            <div className="absolute inset-0 hero-overlay" aria-hidden />
            {/* Soft highlight behind headline area */}
            <div className="absolute inset-0 hero-headline-glow" aria-hidden />
            {/* Optional video layer (desktop) */}
            {DEMO_VIDEO_SRC ? (
              <div className="absolute inset-0 hidden lg:block">
                <video autoPlay muted loop playsInline className="h-full w-full object-cover" src={DEMO_VIDEO_SRC} poster={DEMO_VIDEO_POSTER || undefined} />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-slate-900/20" />
              </div>
            ) : null}
            <div className="relative z-10 p-6 sm:p-8 lg:p-10">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-xs font-semibold uppercase tracking-widest text-primary-500 lg:text-primary-300 mb-3"
              >
                Clinic management, simplified
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
                className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-slate-900 lg:text-white tracking-tight leading-[1.08] max-w-2xl"
              >
                Run your clinic smarter, not harder.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.16 }}
                className="mt-4 text-base sm:text-lg text-slate-600/95 lg:text-white/85 leading-relaxed max-w-lg"
              >
                One place for patients, appointments, prescriptions, and billing—so you focus on care, not spreadsheets.
              </motion.p>
              <motion.ul
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
                className="mt-7 space-y-4"
              >
                {['One dashboard for patients, appointments, and billing', 'Less paperwork—more time with patients', 'Built for clinics who want to grow without the chaos'].map((text, i) => (
                  <motion.li
                    key={i}
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.35 }}
                    className="flex items-center gap-3 text-slate-700 lg:text-slate-100"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-primary-600 lg:bg-white/25 lg:text-white">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <span>{text}</span>
                  </motion.li>
                ))}
              </motion.ul>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.32 }}
                className="mt-9 flex flex-wrap gap-4"
              >
                <a
                  href={DEMO_PHONE}
                  className="btn-cta-primary inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-primary-500/35 hover:from-primary-700 hover:to-primary-800 hover:shadow-2xl hover:shadow-primary-500/40 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-slate-900/50 active:scale-[0.99]"
                  aria-label="Start free trial"
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={DEMO_PHONE}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-primary-400 hover:bg-primary-50/50 hover:text-primary-700 hover:scale-[1.02] active:scale-[0.99] lg:border-white/40 lg:bg-white/10 lg:text-white lg:backdrop-blur-sm lg:hover:bg-white/20 lg:hover:border-white/60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  aria-label="Book a demo"
                >
                  <Phone className="h-4 w-4" />
                  Book a demo
                </a>
              </motion.div>
              {/* Trust: logos + testimonial + stars */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="mt-10 pt-8 border-t border-white/10"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 lg:text-slate-400 mb-3">
                  Trusted by 250+ clinics
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
                  {CLINIC_LOGOS.map((name) => (
                    <span key={name} className="text-sm font-medium text-slate-500/90 lg:text-slate-400/90 grayscale">
                      {name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {[...Array(HERO_TRUST.stars)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                  ))}
                  <span className="text-sm text-slate-600 lg:text-slate-300 font-medium">({HERO_TRUST.stars}.0)</span>
                </div>
                <p className="text-sm text-slate-600 lg:text-slate-200/90 italic">&ldquo;{HERO_TRUST.quote}&rdquo;</p>
                <p className="mt-1 text-xs text-slate-500 lg:text-slate-400">
                  — {HERO_TRUST.name}, {HERO_TRUST.clinic}
                </p>
              </motion.div>
              <motion.a
                href="#features"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-8 inline-flex flex-col items-center gap-1 text-slate-500 hover:text-primary-600 transition-colors lg:text-slate-400 lg:hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-slate-900 rounded-lg py-1"
                aria-label="Scroll to features"
              >
                <span className="text-xs font-medium">Explore more</span>
                <ChevronDown className="h-5 w-5 animate-bounce" />
              </motion.a>
            </div>
          </section>

          <div className="mx-auto w-full max-w-xl lg:max-w-2xl flex-1">

            {/* Who We Are */}
            <section className="mb-16 sm:mb-20">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-4">Who we are</h2>
              <p className="text-slate-600 leading-relaxed text-lg max-w-2xl">
                DoctorDesk was built because we saw clinics drowning in paperwork, double-booked appointments, and scattered patient files. We wanted one place where doctors and staff could save time, reduce stress, and turn daily chaos into a calm, organized workflow. We’re here for modern clinics that care about both patients and their own sanity.
              </p>
              <div className="mt-6 flex items-center gap-2 text-primary-600">
                <Heart className="h-5 w-5" strokeWidth={2} />
                <span className="font-medium">Built for clinics that put care first.</span>
              </div>
            </section>

            {/* Simple Pricing */}
            <section id="pricing" className="mb-16 sm:mb-20 scroll-mt-24">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/30 ring-1 ring-slate-900/5"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary-500/8 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" aria-hidden />
                <div className="relative">
                  <div className="flex flex-wrap items-baseline gap-2 mb-2">
                    <span className="text-2xl sm:text-3xl" aria-hidden>💰</span>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Simple Pricing</h2>
                  </div>
                  <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                    Starts <span className="text-primary-600">₹1,500</span>
                    <span className="text-lg sm:text-xl font-semibold text-slate-500 font-normal">/month</span>
                  </p>
                  <ul className="mt-6 space-y-3">
                    {PRICING_INCLUDES.map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-slate-700">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-600">
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                        <span className="text-base font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-slate-600 leading-relaxed max-w-lg">
                    Perfect for single-doctor clinics, new practices, and growing healthcare centers.
                  </p>
                  <a
                    href={DEMO_PHONE}
                    className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all duration-200 ease-out hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    aria-label="Start free trial"
                  >
                    Start free trial
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </motion.div>
            </section>

            {/* Features */}
            <section id="features" className="mb-16 sm:mb-20 scroll-mt-24">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-8">Everything you need in one place</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                {FEATURES.map(({ icon: Icon, title, desc }, i) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.35, delay: i * 0.06 }}
                    className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary-200/60"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 transition-colors group-hover:bg-primary-500/15">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Security & Compliance */}
            <section id="security" className="mb-16 sm:mb-20 scroll-mt-24">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-8">Security & compliance</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                {SECURITY_ITEMS.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Testimonials */}
            <section className="mb-16 sm:mb-20">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-8">What clinics say</h2>
              <div className="grid sm:grid-cols-3 gap-5">
                {TESTIMONIALS.map(({ name, clinic, quote, initials }) => (
                  <div
                    key={name}
                    className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <p className="text-slate-600 italic leading-relaxed">"{quote}"</p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-600 font-semibold text-sm">
                        {initials}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{name}</p>
                        <p className="text-sm text-slate-500">{clinic}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Bottom CTA */}
            <section id="contact" className="mb-12 scroll-mt-24 rounded-2xl bg-slate-900 px-6 py-10 sm:p-12 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Ready to simplify your clinic?
              </h2>
              <p className="mt-4 text-slate-300 max-w-lg mx-auto">
                Join 250+ clinics. Start a free trial or book a demo—we’ll get you set up quickly.
              </p>
              <ul className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-400" />
                  No credit card required
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-400" />
                  Setup in under a day
                </li>
              </ul>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <a
                  href={DEMO_PHONE}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:bg-primary-400 hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                  aria-label="Start free trial"
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={DEMO_PHONE}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-slate-600 bg-transparent px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:bg-slate-700 hover:border-slate-500 hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
                  aria-label="Book a demo"
                >
                  <Phone className="h-4 w-4" />
                  Book a demo
                </a>
              </div>
            </section>
          </div>
        </div>

        {/* Right: Login card – vertically centered, glassmorphism */}
        <div className="px-4 py-8 lg:py-14 lg:pl-0 lg:pr-8 xl:pr-12 flex flex-col justify-center lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100dvh-6rem)]">
          <div className="mx-auto w-full max-w-md">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={shake ? { x: [0, -8, 8, -8, 8, 0], opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
              transition={{ x: { duration: 0.5 }, opacity: { duration: 0.4 }, y: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }}
              className="login-card-glass rounded-2xl border border-slate-200/80 p-6 sm:p-8"
            >
                <div className="text-center mb-7">
<div className="mb-5 flex justify-center">
                  <Logo className="text-2xl sm:text-3xl" aria-hidden />
                </div>
                  <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
                  <p className="mt-1.5 text-sm text-slate-500">Use your clinic email and password</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                  {submitError && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5 border border-red-100" role="alert" aria-live="polite">
                      {submitError}
                    </p>
                  )}
                  <FormInput
                    label="Email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                    onBlur={handleEmailBlur}
                    placeholder="you@clinic.com"
                    required
                    autoComplete="email"
                    error={emailError}
                  />
                  <FormInput
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                    onBlur={handlePasswordBlur}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    error={passwordError}
                    rightAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset min-h-[44px] min-w-[44px]"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    }
                  />
                  <div className="flex items-center justify-between gap-4">
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0"
                        aria-label="Remember me"
                      />
                      <span className="text-sm text-slate-600">Remember me</span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-sm font-medium text-primary-600 hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[44px] rounded-xl bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all duration-200 ease-out hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.99] disabled:opacity-70 disabled:pointer-events-none disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    aria-busy={loading}
                  >
                    {loading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                        Signing in…
                      </span>
                    ) : (
                      'Sign in'
                    )}
                  </button>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center" aria-hidden>
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white/95 px-3 text-sm text-slate-500">New to DoctorDesk?</span>
                    </div>
                  </div>
                  <a
                    href={DEMO_PHONE}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-primary-600 bg-transparent py-3.5 text-sm font-semibold text-primary-600 transition-all duration-200 ease-out hover:bg-primary-50 hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    aria-label="Start free trial"
                  >
                    Start free trial
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </form>
            </motion.div>
          </div>
        </div>
      </div>

    </div>
  );
}
