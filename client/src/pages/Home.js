import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "react-query";
import {
  FaBitcoin,
  FaArrowUp,
  FaStar,
  FaChartLine,
  FaClock,
} from "react-icons/fa";
import axios from "../setupAxios";
import PollCard from "../components/polls/PollCard";
import LoadingSpinner from "../components/common/LoadingSpinner";
import logo from "../assets/imgs/bw-logo.png";

const Home = () => {
  // Fetch trending polls
  const { data: trendingPolls, isLoading: trendingLoading } = useQuery(
    "trending-polls",
    async () => {
      const response = await axios.get("/api/polls/trending?limit=6");
      return response.data;
    }
  );

  // Fetch featured polls
  const { data: featuredPolls, isLoading: featuredLoading } = useQuery(
    "featured-polls",
    async () => {
      const response = await axios.get("/api/polls?featured=true&limit=8");
      return response.data;
    }
  );

  const categories = [
    {
      name: "Politics",
      path: "/politics",
      icon: "🏛️",
      description: "Political predictions and elections",
      color: "bg-red-500",
    },
    {
      name: "Crypto",
      path: "/crypto",
      icon: "₿",
      description: "Cryptocurrency and blockchain",
      color: "bg-yellow-500",
    },
    {
      name: "Tech",
      path: "/tech",
      icon: "💻",
      description: "Technology and innovation",
      color: "bg-blue-500",
    },
    {
      name: "Sports",
      path: "/sports",
      icon: "⚽",
      description: "Sports and competitions",
      color: "bg-green-500",
    },
    {
      name: "Economy",
      path: "/economy",
      icon: "📈",
      description: "Economic indicators and markets",
      color: "bg-purple-500",
    },
    {
      name: "World",
      path: "/world",
      icon: "🌍",
      description: "Global events and geopolitics",
      color: "bg-indigo-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-bitcoin-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img src={logo} alt="BitcoinWorld Logo" className="w-16 h-16" />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Welcome to <span className="text-bitcoin-300">BitcoinWorld</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-primary-100 max-w-3xl mx-auto">
              The world's premier prediction marketplace. Trade on the future
              with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/trending"
                className="btn bg-white text-primary-700 hover:bg-gray-100 px-8 py-3 text-lg font-semibold"
              >
                Start Trading
              </Link>
              <Link
                to="/learn"
                className="btn border-2 border-white text-white hover:bg-white hover:text-primary-700 px-8 py-3 text-lg font-semibold"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Explore Categories
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Find predictions in your areas of interest
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <Link
                key={category.name}
                to={category.path}
                className="card-hover p-6 text-center group"
              >
                <div
                  className={`w-16 h-16 ${category.color} rounded-full flex items-center justify-center mx-auto mb-4 text-2xl text-white group-hover:scale-110 transition-transform`}
                >
                  {category.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {category.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {category.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <FaArrowUp className="w-6 h-6 text-orange-500" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Trending Now
              </h2>
            </div>
            <Link
              to="/trending"
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
            >
              View All →
            </Link>
          </div>

          {trendingLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingPolls?.slice(0, 6).map((poll) => (
                <PollCard key={poll._id} poll={poll} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <FaStar className="w-6 h-6 text-yellow-500" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Featured Polls
              </h2>
            </div>
          </div>

          {featuredLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredPolls?.polls?.slice(0, 8).map((poll) => (
                <PollCard key={poll._id} poll={poll} compact />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-bitcoin-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              BitcoinWorld by the Numbers
            </h2>
            <p className="text-xl text-primary-100">
              Join thousands of traders making predictions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">10K+</div>
              <div className="text-primary-100">Active Traders</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">$2M+</div>
              <div className="text-primary-100">Total Volume</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">500+</div>
              <div className="text-primary-100">Active Markets</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">95%</div>
              <div className="text-primary-100">Accuracy Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-100 dark:bg-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Ready to Start Trading?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Join BitcoinWorld today and start making predictions on the world's
            most important events.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/trending" className="btn-primary btn-lg">
              Browse Markets
            </Link>
            <Link to="/learn" className="btn-outline btn-lg">
              Learn How It Works
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
