import React from 'react';
import Header from '../components/layout/Header';
import HomeHero from '../components/sections/HomeHero';
import HomeServices from '../components/sections/HomeServices';
import HomeTestimonials from '../components/sections/HomeTestimonials';
import HomeCTA from '../components/sections/HomeCTA';
import Footer from '../components/layout/Footer';

const HomePage: React.FC = () => {
  return (
    <>
      <Header />
      <main>
        <HomeHero />
        <HomeServices />
        <HomeTestimonials />
        <HomeCTA />
      </main>
      <Footer />
    </>
  );
};

export default HomePage;