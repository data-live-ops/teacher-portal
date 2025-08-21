import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertCircle, CheckCircle, XCircle, Search, Filter } from 'lucide-react';
import '../styles/TeacherAssignment.css';
import { supabase } from '../lib/supabaseClient.mjs';

const TeacherUtilization = () => {
    const [utilizationData, setUtilizationData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        level: '',
        gjStatus50: '',
        gjStatus75: '',
        mentorStatus: ''
    });

    useEffect(() => {
        loadUtilizationData();
    }, []);

    const loadUtilizationData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('teacher_utilization')
                .select(`
                    *,
                    teacher_leveling:teacher_leveling_id(
                        level,
                        responsibility
                    )
                `)
                .order('teacher_name');

            if (error) throw error;

            const formattedData = data.map(item => ({
                ...item,
                level: item.teacher_leveling?.level || 'Unknown',
                responsibility: item.teacher_leveling?.responsibility || 'Unknown'
            }));

            setUtilizationData(formattedData);
        } catch (error) {
            console.error('Error loading utilization data:', error);
            alert('Failed to load teacher utilization data');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'FULL CAPACITY': { color: 'success', icon: CheckCircle },
            'MEET MINIMUM': { color: 'warning', icon: AlertCircle },
            'BELOW MINIMUM': { color: 'danger', icon: XCircle }
        };

        const config = statusConfig[status] || { color: 'neutral', icon: AlertCircle };
        const Icon = config.icon;

        return (
            <span className={`status-badge status-${config.color}`}>
                <Icon size={12} />
                {status || 'N/A'}
            </span>
        );
    };

    const filteredData = utilizationData.filter(teacher => {
        const matchesSearch = teacher.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            teacher.level.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilters =
            (!filters.level || teacher.level === filters.level) &&
            (!filters.gjStatus50 || teacher.minimum_50_teacher_utilization_status === filters.gjStatus50) &&
            (!filters.gjStatus75 || teacher.minimum_75_teacher_utilization_status === filters.gjStatus75) &&
            (!filters.mentorStatus || teacher.minimum_mentor_utilization_status === filters.mentorStatus);

        return matchesSearch && matchesFilters;
    });

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <div className="loading-text">Loading teacher utilization data...</div>
            </div>
        );
    }

    return (
        <div className="teacher-utilization-container">
            <div className="header">
                <div className="header-actions">
                    <div className="search-bar">
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search teachers or leveling.."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="filter-group">
                        <select
                            value={filters.level}
                            onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                            className="filter-select"
                        >
                            <option value="">All Levels</option>
                            {[...new Set(utilizationData.map(t => t.level))].map(level => (
                                <option key={level} value={level}>{level}</option>
                            ))}
                        </select>

                        <select
                            value={filters.gjStatus50}
                            onChange={(e) => setFilters({ ...filters, gjStatus50: e.target.value })}
                            className="filter-select"
                        >
                            <option value="">All GJ 50% Status</option>
                            <option value="FULL CAPACITY">Full Capacity</option>
                            <option value="MEET MINIMUM">Meet Minimum</option>
                            <option value="BELOW MINIMUM">Below Minimum</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-container">
                <div className="stat-card">
                    <Users className="stat-icon" size={40} />
                    <div>
                        <p className="stat-label">Total Teachers</p>
                        <p className="stat-value">{utilizationData.length}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <CheckCircle className="stat-icon" size={40} />
                    <div>
                        <p className="stat-label">Full Capacity (50%)</p>
                        <p className="stat-value">
                            {utilizationData.filter(t => t.minimum_50_teacher_utilization_status === 'FULL CAPACITY').length}
                        </p>
                    </div>
                </div>

                <div className="stat-card">
                    <AlertCircle className="stat-icon" size={40} />
                    <div>
                        <p className="stat-label">Below Minimum (50%)</p>
                        <p className="stat-value">
                            {utilizationData.filter(t => t.minimum_50_teacher_utilization_status === 'BELOW MINIMUM').length}
                        </p>
                    </div>
                </div>

                <div className="stat-card">
                    <TrendingUp className="stat-icon" size={40} />
                    <div>
                        <p className="stat-label">Avg GJ Utilization</p>
                        <p className="stat-value">
                            {utilizationData.length > 0
                                ? Math.round(utilizationData.reduce((sum, t) => sum + (parseFloat(t.teacher_utilization_percentage) || 0), 0) / utilizationData.length)
                                : 0}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <div className="table-header">
                    <h3>Teacher Utilization Details</h3>
                    <p>{filteredData.length} teachers found</p>
                </div>

                <div className="table-wrapper">
                    <table className="utilization-table">
                        <thead>
                            <tr>
                                <th>Teacher Name</th>
                                <th>Level</th>
                                <th>Responsibility</th>
                                <th>Scheduled as GJ</th>
                                <th>Scheduled as GJ Other</th>
                                <th>Scheduled as Mentor</th>
                                <th>GJ Utilization (%)</th>
                                <th>In-Class Utilization (%)</th>
                                <th>Min GJ 50% Status</th>
                                <th>In-Class Status</th>
                                <th>Min GJ 75% Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((teacher) => (
                                <tr key={teacher.id}>
                                    <td className="teacher-name">
                                        <div className="name-cell">
                                            {teacher.teacher_name}
                                        </div>
                                    </td>
                                    <td>{teacher.level}</td>
                                    <td className="responsibility-cell">{teacher.responsibility}</td>
                                    <td className="hours-cell">{teacher.hours_as_teacher_in_mandatory_class || 0}h</td>
                                    <td className="hours-cell">{teacher.hours_as_teacher_in_non_mandatory_class || 0}h</td>
                                    <td className="hours-cell">{teacher.hours_as_mentor || 0}h</td>
                                    <td className="percentage-cell">
                                        <div className="percentage-bar">
                                            <div
                                                className="percentage-fill"
                                                style={{ width: `${Math.min(parseFloat(teacher.teacher_utilization_percentage) || 0, 100)}%` }}
                                            ></div>
                                            <span className="percentage-text">
                                                {teacher.teacher_utilization_percentage || 0}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="percentage-cell">
                                        <div className="percentage-bar">
                                            <div
                                                className="percentage-fill mentor"
                                                style={{ width: `${Math.min(parseFloat(teacher.mentor_utilization_percentage) || 0, 100)}%` }}
                                            ></div>
                                            <span className="percentage-text">
                                                {teacher.mentor_utilization_percentage || 0}%
                                            </span>
                                        </div>
                                    </td>
                                    <td>{getStatusBadge(teacher.minimum_50_teacher_utilization_status)}</td>
                                    <td>{getStatusBadge(teacher.minimum_mentor_utilization_status)}</td>
                                    <td>{getStatusBadge(teacher.minimum_75_teacher_utilization_status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredData.length === 0 && (
                    <div className="empty-state">
                        <Users size={48} />
                        <p>No teachers found matching your criteria</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeacherUtilization;