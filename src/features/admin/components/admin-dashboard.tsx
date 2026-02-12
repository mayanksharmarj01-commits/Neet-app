'use client';

import { useState, useEffect } from 'react';

interface DashboardStats {
    dau: number;
    mau: number;
    churnRate: number;
    revenue: {
        totalRevenue: number;
        subscriptionRevenue: number;
        newSubscriptions: number;
        renewedSubscriptions: number;
        averageDealSize: number;
    };
    activeSubscribers: number;
    totalUsers: number;
}

export function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        fetchStats();
    }, [dateRange]);

    const fetchStats = async () => {
        try {
            const response = await fetch(
                `/api/admin/dashboard?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
            );
            const data = await response.json();

            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center py-12">
                <p className="text-red-600">Failed to load dashboard stats</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
                    <p className="text-gray-600">System analytics and management</p>
                </div>

                {/* Date Range Selector */}
                <div className="bg-white rounded-lg shadow p-6 mb-8">
                    <h3 className="text-lg font-semibold mb-4">Date Range</h3>
                    <div className="flex gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* DAU */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                        <div className="text-sm font-medium opacity-90 mb-2">Daily Active Users</div>
                        <div className="text-4xl font-bold mb-1">{stats.dau.toLocaleString()}</div>
                        <div className="text-xs opacity-75">Today's active users</div>
                    </div>

                    {/* MAU */}
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                        <div className="text-sm font-medium opacity-90 mb-2">Monthly Active Users</div>
                        <div className="text-4xl font-bold mb-1">{stats.mau.toLocaleString()}</div>
                        <div className="text-xs opacity-75">This month</div>
                    </div>

                    {/* Active Subscribers */}
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                        <div className="text-sm font-medium opacity-90 mb-2">Active Subscribers</div>
                        <div className="text-4xl font-bold mb-1">{stats.activeSubscribers.toLocaleString()}</div>
                        <div className="text-xs opacity-75">Paying users</div>
                    </div>

                    {/* Churn Rate */}
                    <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
                        <div className="text-sm font-medium opacity-90 mb-2">Churn Rate</div>
                        <div className="text-4xl font-bold mb-1">{stats.churnRate.toFixed(1)}%</div>
                        <div className="text-xs opacity-75">Period churn</div>
                    </div>
                </div>

                {/* Revenue Section */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Revenue Metrics</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <div className="text-sm font-medium text-gray-600 mb-2">Total Revenue</div>
                            <div className="text-3xl font-bold text-gray-900">
                                ₹{stats.revenue.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-600 mb-2">Subscription Revenue</div>
                            <div className="text-3xl font-bold text-indigo-600">
                                ₹{stats.revenue.subscriptionRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-600 mb-2">Average Deal Size</div>
                            <div className="text-3xl font-bold text-green-600">
                                ₹{stats.revenue.averageDealSize.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div className="p-4 bg-green-50 rounded-lg">
                            <div className="text-sm font-medium text-green-800 mb-1">New Subscriptions</div>
                            <div className="text-2xl font-bold text-green-900">
                                {stats.revenue.newSubscriptions}
                            </div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <div className="text-sm font-medium text-blue-800 mb-1">Renewed Subscriptions</div>
                            <div className="text-2xl font-bold text-blue-900">
                                {stats.revenue.renewedSubscriptions}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Users */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">User Base</h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-gray-600 mb-2">Total Registered Users</div>
                            <div className="text-4xl font-bold text-gray-900">
                                {stats.totalUsers.toLocaleString()}
                            </div>
                        </div>
                        <div className="text-6xl opacity-10">👥</div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="p-4 bg-purple-50 rounded-lg">
                            <div className="text-sm font-medium text-purple-800 mb-1">Conversion Rate</div>
                            <div className="text-2xl font-bold text-purple-900">
                                {((stats.activeSubscribers / stats.totalUsers) * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div className="p-4 bg-indigo-50 rounded-lg">
                            <div className="text-sm font-medium text-indigo-800 mb-1">DAU/MAU Ratio</div>
                            <div className="text-2xl font-bold text-indigo-900">
                                {((stats.dau / stats.mau) * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
