import React, { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import Button from '../ui/Button';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <a 
              href="#" 
              className="flex items-center"
            >
              <img 
                src="/Modern Minimalist Logo for Boxed2Built.png" 
                alt="Boxed2Built Logo" 
                className="h-12 w-auto"
              />
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a 
              href="#about" 
              onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              About
            </a>
            <a 
              href="#services" 
              onClick={(e) => { e.preventDefault(); scrollToSection('services'); }}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Services
            </a>
            <a 
              href="#testimonials" 
              onClick={(e) => { e.preventDefault(); scrollToSection('testimonials'); }}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Testimonials
            </a>
          </nav>

          <div className="hidden md:flex items-center">
            <a 
              href="tel:6154034538" 
              className="flex items-center text-gray-800 hover:text-blue-600 mr-4 transition-colors"
            >
              <Phone size={18} className="mr-2" />
              <span>(615) 403-4538</span>
            </a>
            <Button 
              onClick={() => window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Quote%20Request&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.'}
              variant="primary"
            >
              Get a Free Quote
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden text-gray-700 focus:outline-none"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className={`md:hidden mt-4 pb-4 ${!isScrolled ? 'bg-white shadow-lg rounded-lg' : ''}`}>
            <nav className="flex flex-col space-y-4 p-4">
              <a 
                href="#about" 
                onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                About
              </a>
              <a 
                href="#services" 
                onClick={(e) => { e.preventDefault(); scrollToSection('services'); }}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Services
              </a>
              <a 
                href="#testimonials" 
                onClick={(e) => { e.preventDefault(); scrollToSection('testimonials'); }}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Testimonials
              </a>
              <a 
                href="tel:6154034538" 
                className="flex items-center text-gray-800 hover:text-blue-600 transition-colors"
              >
                <Phone size={18} className="mr-2" />
                <span>(615) 403-4538</span>
              </a>
              <Button 
                onClick={() => window.location.href = 'mailto:boxed2builtco@gmail.com?subject=Quote%20Request&body=I%20would%20like%20to%20request%20a%20quote%20for%20furniture%20assembly.'}
                variant="primary"
                className="w-full justify-center"
              >
                Get a Free Quote
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;