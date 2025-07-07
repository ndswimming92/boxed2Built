import React from 'react';
import Header from '../components/layout/Header';
import Hero from '../components/sections/Hero';
import Services from '../components/sections/Services';
import About from '../components/sections/About';
import Booking from '../components/sections/Booking';
import Footer from '../components/layout/Footer';

const HomePage: React.FC = () => {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services />
        <About />
        <Booking />
      </main>
      <Footer />
    </>
  );
};

export default HomePage;