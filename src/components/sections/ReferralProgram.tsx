import { Gift, Users, DollarSign, ArrowRight, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ReferralProgram() {
  return (
    <section className="py-16 bg-gradient-to-br from-blue-700 to-blue-900 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-8 left-12 w-48 h-48 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-8 right-12 w-64 h-64 bg-blue-300 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-full mb-5 border border-white/20 backdrop-blur-sm">
              <Gift className="w-4 h-4" />
              Referral Program
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Give $25. Get $25.
            </h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Share your unique referral code with friends and family. When they book their first service, you both save.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-7 h-7 text-white" />
              </div>
              <div className="text-white font-bold text-lg mb-2">Share Your Code</div>
              <p className="text-blue-100 text-sm leading-relaxed">
                After your job is completed, you'll receive a personal referral code to share with anyone.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div className="text-white font-bold text-lg mb-2">Friend Books a Job</div>
              <p className="text-blue-100 text-sm leading-relaxed">
                Your friend enters your code when requesting a quote. They get $25 off their first service.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <div className="text-white font-bold text-lg mb-2">You Earn $25 Credit</div>
              <p className="text-blue-100 text-sm leading-relaxed">
                Once their job is completed, $25 is added to your account as a discount on your next invoice.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-white text-blue-800 font-bold px-8 py-4 rounded-xl hover:bg-blue-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-base"
            >
              Get a Free Quote
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-blue-200 text-sm text-center">
              Already a client? Your referral code is in your client profile.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
