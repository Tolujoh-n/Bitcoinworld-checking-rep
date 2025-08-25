import React from "react";
import { Link } from "react-router-dom";
import {
  FaTwitter,
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaGithub,
  FaBitcoin,
} from "react-icons/fa";
import logo from "../../assets/imgs/bw-logo.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { name: "Privacy", href: "/privacy" },
    { name: "Terms of Use", href: "/terms" },
    { name: "Learn", href: "/learn" },
    { name: "Careers", href: "/careers" },
    { name: "Press", href: "/press" },
  ];

  const socialLinks = [
    {
      name: "Twitter",
      icon: FaTwitter,
      href: "https://twitter.com/bitcoinworld",
    },
    {
      name: "Facebook",
      icon: FaFacebook,
      href: "https://facebook.com/bitcoinworld",
    },
    {
      name: "Instagram",
      icon: FaInstagram,
      href: "https://instagram.com/bitcoinworld",
    },
    {
      name: "LinkedIn",
      icon: FaLinkedin,
      href: "https://linkedin.com/company/bitcoinworld",
    },
    { name: "GitHub", icon: FaGithub, href: "https://github.com/bitcoinworld" },
  ];

  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Left Side - Company Info */}
          <div className="flex items-center space-x-2">
            <img src={logo} alt="BitcoinWorld Logo" className="w-6 h-6" />
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              BitcoinWorld Inc.
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              © {currentYear}
            </span>
          </div>

          {/* Center - Navigation Links */}
          <div className="flex items-center space-x-6">
            {footerLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors text-sm"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Right Side - Social Media */}
          <div className="flex items-center space-x-4">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label={social.name}
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>

        {/* Note: Removed duplicate mobile section to avoid double footer on small screens */}
      </div>
    </footer>
  );
};

export default Footer;
