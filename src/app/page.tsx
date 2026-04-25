import Link from 'next/link'
import Image from 'next/image'
import loomBg from '../../images/Loom.png'
import img1 from '../../images/1.png'
import img2 from '../../images/2.png'
import img3 from '../../images/3.png'
import img4 from '../../images/4.png'
import { Bot, Zap, TrendingUp, ShoppingBag, MessageSquare, ArrowRight, Megaphone, BarChart2, Brain, Lightbulb, RefreshCw, Layers } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LOOM</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-primary text-sm">
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 min-h-[760px] flex flex-col justify-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src={loomBg}
            alt="LOOM background"
            fill
            className="object-contain object-center"
            priority
          />
          <div className="absolute inset-0 bg-white/55" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto text-center w-full">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-violet-700 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-violet-200/30">
            <Zap className="w-4 h-4" />
            Built for Founders. Powered by Intelligence
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            Your Business on{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-500">
              Autopilot
            </span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            LOOM connects AI to your business — handling customers, taking orders, managing marketing, autonomous ads campaign and making decisions. 24/7. Zero effort.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard" className="btn-primary flex items-center justify-center gap-2 text-base px-8 py-3">
              Start for Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#how" className="btn-secondary flex items-center justify-center gap-2 text-base px-8 py-3">
              See How It Works
            </Link>
          </div>
          <div className="mt-12 sm:mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-xs sm:max-w-3xl mx-auto w-full">
            {[
              { icon: MessageSquare, label: 'AI takes orders via Telegram', color: 'bg-blue-50 text-blue-600' },
              { icon: TrendingUp, label: 'Smart marketing suggestions', color: 'bg-green-50 text-green-600' },
              { icon: ShoppingBag, label: 'Automated order tracking', color: 'bg-amber-50 text-amber-600' },
              { icon: Megaphone, label: 'AI-powered ad campaigns', color: 'bg-violet-50 text-violet-600' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="bg-white/35 backdrop-blur-sm border border-white/40 rounded-2xl flex flex-col items-center gap-3 p-4 sm:p-5 text-center shadow-sm w-full">
                <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-xs sm:text-sm text-gray-700 font-medium leading-snug">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BUSINESS TYPES */}
      <section className="py-20 bg-gray-50 px-4 sm:px-6" id="how">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Built for Every Business</h2>
            <p className="text-gray-500">Tell LOOM your business type — it customizes everything for you.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { img: img1, border: 'border-orange-200', type: 'Food & Beverage', headline: 'From Orders to Delivery — Fully Orchestrated.', desc: 'Restaurants, cafés, or food stalls — LOOM manages orders, optimizes menus, and coordinates delivery seamlessly in real time.' },
              { img: img2, border: 'border-blue-200', type: 'Physical Products', headline: 'Smart Inventory. Smarter Sales.', desc: 'Clothing, merchandise, and retail — AI tracks inventory, manages shipping, and handles customer queries automatically.' },
              { img: img3, border: 'border-violet-200', type: 'Digital Products', headline: 'Sell Once. Deliver Infinitely.', desc: 'Courses, software, and digital assets — LOOM automates delivery, onboarding, and customer experience at scale.' },
              { img: img4, border: 'border-green-200', type: 'Services', headline: 'From Booking to Completion On Autopilot.', desc: 'Consulting, repairs, or freelance services — AI schedules appointments, manages clients, and ensures smooth operations.' },
            ].map(({ img, border, type, headline, desc }) => (
              <div key={type} className={`rounded-2xl border-2 ${border} bg-white overflow-hidden flex flex-col`}>
                <div className="relative w-full h-52 bg-gray-50">
                  <Image src={img} alt={type} fill className="object-contain p-2" />
                </div>
                <div className="p-5 flex flex-col gap-1 flex-1">
                  <h3 className="font-bold text-gray-900">{type}</h3>
                  <p className="text-xs text-violet-600 font-semibold italic mb-1">&ldquo;{headline}&rdquo;</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-4 sm:px-6 bg-white" id="features">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Everything Built In</h2>
            <p className="text-gray-500">LOOM is a complete business intelligence system — not a collection of tools.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: MessageSquare,
                title: 'Customer Interaction AI',
                tagline: 'Engage, respond, and convert — automatically.',
                desc: 'LOOM communicates with customers in real time, answers queries, and drives conversions without human input.',
                bg: 'bg-blue-50', border: 'border-blue-100', icon_bg: 'bg-blue-100', icon_color: 'text-blue-600', tag_color: 'text-blue-500',
              },
              {
                icon: ShoppingBag,
                title: 'Order & Operations Management',
                tagline: 'From order to delivery — fully handled.',
                desc: 'Manages orders, inventory, and workflows seamlessly across your business.',
                bg: 'bg-amber-50', border: 'border-amber-100', icon_bg: 'bg-amber-100', icon_color: 'text-amber-600', tag_color: 'text-amber-500',
              },
              {
                icon: TrendingUp,
                title: 'Autonomous Growth Engine',
                tagline: 'AI-powered marketing that executes.',
                desc: 'Creates, optimizes, and runs campaigns based on real-time data.',
                bg: 'bg-green-50', border: 'border-green-100', icon_bg: 'bg-green-100', icon_color: 'text-green-600', tag_color: 'text-green-500',
              },
              {
                icon: Brain,
                title: 'Multi-Agent Decision System',
                tagline: 'Not one AI — a board of intelligence.',
                desc: 'CEO, CFO, CMO, and CTO agents analyze, debate, and choose the best strategy.',
                bg: 'bg-violet-50', border: 'border-violet-100', icon_bg: 'bg-violet-100', icon_color: 'text-violet-600', tag_color: 'text-violet-500',
              },
              {
                icon: BarChart2,
                title: 'Real-Time Intelligence',
                tagline: 'Decisions backed by live data.',
                desc: 'Uses analytics and trends to continuously adapt and improve performance.',
                bg: 'bg-sky-50', border: 'border-sky-100', icon_bg: 'bg-sky-100', icon_color: 'text-sky-600', tag_color: 'text-sky-500',
              },
              {
                icon: Lightbulb,
                title: 'Opportunity Detection',
                tagline: 'Find growth before others do.',
                desc: 'Identifies trends, market gaps, and high-potential opportunities automatically.',
                bg: 'bg-orange-50', border: 'border-orange-100', icon_bg: 'bg-orange-100', icon_color: 'text-orange-600', tag_color: 'text-orange-500',
              },
              {
                icon: RefreshCw,
                title: 'Self-Optimizing System',
                tagline: 'Improves while you sleep.',
                desc: 'LOOM learns from every action and refines strategies automatically over time.',
                bg: 'bg-rose-50', border: 'border-rose-100', icon_bg: 'bg-rose-100', icon_color: 'text-rose-600', tag_color: 'text-rose-500',
              },
              {
                icon: Layers,
                title: 'Unified Business Control',
                tagline: 'Everything connected. One intelligent system.',
                desc: 'Customers, orders, marketing, and decisions — all managed in one place.',
                bg: 'bg-purple-50', border: 'border-purple-100', icon_bg: 'bg-purple-100', icon_color: 'text-purple-600', tag_color: 'text-purple-500',
              },
            ].map(({ icon: Icon, title, tagline, desc, bg, border, icon_bg, icon_color, tag_color }) => (
              <div key={title} className={`${bg} ${border} border rounded-2xl p-5 flex flex-col gap-3`}>
                <div className={`w-9 h-9 rounded-xl ${icon_bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${icon_color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{title}</h3>
                  <p className={`text-xs font-semibold italic mb-2 ${tag_color}`}>&ldquo;{tagline}&rdquo;</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-violet-500" id="about">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">About LOOM</h2>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 sm:p-8 md:p-12 border border-white/20 space-y-5 sm:space-y-6">
            <p className="text-violet-100 text-base sm:text-lg leading-relaxed">
              LOOM is not just another AI tool, it&apos;s a new way of building and running businesses. We believe the future of entrepreneurship is not about doing more, but about thinking smarter. LOOM transforms a simple idea into a fully functioning business by combining intelligent automation, real-time data, and multi-agent decision making.
            </p>
            <p className="text-violet-100 text-base sm:text-lg leading-relaxed">
              Instead of relying on one perspective, LOOM operates through a system of AI roles — a{' '}
              <span className="font-semibold text-white">CEO, CFO, CMO, and CTO</span>{' '}
               that analyze, debate, and execute strategies together. From creating products and launching marketing campaigns to analyzing performance and optimizing growth, LOOM handles the entire business lifecycle.
            </p>
            <p className="text-violet-100 text-base sm:text-lg leading-relaxed">
              It doesn&apos;t just assist,it decides, adapts, and improves continuously.
            </p>
            <p className="text-violet-100 text-base sm:text-lg leading-relaxed">
              Our mission is simple: to make building and running a business as easy as giving a single prompt.
            </p>
            <p className="text-white text-base sm:text-lg font-semibold leading-relaxed border-t border-white/20 pt-5 sm:pt-6">
              LOOM isn&apos;t just automation. It&apos;s autonomous intelligence for the next generation of businesses.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-6 border-t border-gray-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">LOOM</span>
          </div>
          <p className="text-sm text-gray-400">© 2026 LOOM. AI-powered business automation.</p>
          <p className="text-sm text-gray-400">Built for Founders. Powered by Intelligence.</p>
        </div>
      </footer>
    </div>
  )
}
