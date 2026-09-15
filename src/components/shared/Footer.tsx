import React from 'react';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="text-2xl font-bold text-white flex items-center gap-2 mb-4">
              <span className="bg-brand-primary text-white p-1 rounded">Ed</span>
              <span>Education-Course</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              Empowering students across India with industry-standard professional courses. Learn from the best, achieve your dreams.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/courses" className="hover:text-white transition-colors">All Courses</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Contact Us</h4>
            <ul className="space-y-2 text-sm">
              <li>📧 support@education-course.com</li>
              <li>📞 +91 98765 43210</li>
              <li>📍 New Delhi, India</li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Education-Course. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
