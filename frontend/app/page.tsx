'use client';

import axios from 'axios';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface AnalysisResult {
    success: boolean;
    analysis?: string;
    metadata?: {
        resume_length: number;
        filename: string;
        model_used: string;
        service: string;
    };
    detail?: string;
}

interface HealthStatus {
    status: string;
    api_configured: boolean;
    service?: string;
    model?: string;
    message?: string;
}

export default function Page() {
    const [file, setFile] = useState<File | null>(null);
    const [jobDescription, setJobDescription] = useState('');
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [apiStatus, setApiStatus] = useState<HealthStatus | null>(null);
    const [checkingApi, setCheckingApi] = useState(true);

    useEffect(() => {
        checkApiStatus();
    }, []);

    const checkApiStatus = async () => {
        setCheckingApi(true);
        try {
            const response = await axios.get<HealthStatus>(`${API_URL}/health`, {
                timeout: 5000
            });
            setApiStatus(response.data);
        } catch (err) {
            setApiStatus({
                status: 'unhealthy',
                api_configured: false,
                message: 'Cannot connect to backend. Make sure the server is running.'
            });
        } finally {
            setCheckingApi(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const fileName = selectedFile.name.toLowerCase();

            if (!fileName.endsWith('.pdf') && !fileName.endsWith('.docx')) {
                setError('Please upload a PDF or DOCX file');
                setFile(null);
                return;
            }

            // Check file size (max 10MB)
            if (selectedFile.size > 10 * 1024 * 1024) {
                setError('File size must be less than 10MB');
                setFile(null);
                return;
            }

            setFile(selectedFile);
            setError('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError('Please upload your resume');
            return;
        }

        if (!jobDescription.trim()) {
            setError('Please enter a job description');
            return;
        }

        if (jobDescription.trim().length < 50) {
            setError('Job description is too short. Please provide more details.');
            return;
        }

        setLoading(true);
        setError('');
        setAnalysis('');

        try {
            const formData = new FormData();
            formData.append('resume', file);
            formData.append('job_description', jobDescription);

            const response = await axios.post<AnalysisResult>(
                `${API_URL}/analyze`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 60000 // 60 seconds
                }
            );

            if (response.data.success && response.data.analysis) {
                setAnalysis(response.data.analysis);
            } else {
                setError(response.data.detail || 'Analysis failed. Please try again.');
            }
        } catch (err: any) {
            console.error('Analysis error:', err);

            if (err.response?.data?.detail) {
                setError(err.response.data.detail);
            } else if (err.code === 'ECONNABORTED') {
                setError('Request timeout. The file might be too large or the server is slow.');
            } else if (err.message.includes('Network Error')) {
                setError('Cannot connect to server. Please check if the backend is running.');
            } else {
                setError('Failed to analyze resume. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const formatAnalysis = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, index) => {
            const trimmedLine = line.trim();

            // Headers (numbers or all caps)
            if (trimmedLine.match(/^\d+\.|^[A-Z\s]{3,}:?$/)) {
                return (
                    <h3 key={index} className="text-xl font-bold text-gray-900 mt-6 mb-2">
                        {trimmedLine}
                    </h3>
                );
            }

            // Subheaders (starts with -)
            if (trimmedLine.startsWith('-')) {
                return (
                    <li key={index} className="ml-6 text-gray-700 mb-1">
                        {trimmedLine.substring(1).trim()}
                    </li>
                );
            }

            // Empty lines
            if (trimmedLine === '') {
                return <div key={index} className="h-2" />;
            }

            // Regular paragraphs
            return (
                <p key={index} className="text-gray-700 mb-2 leading-relaxed">
                    {trimmedLine}
                </p>
            );
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
            <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">

                {/* Header */}
                <header className="text-center mb-8 sm:mb-12">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-3 sm:mb-4">
                        Resume Analyzer
                    </h1>
                    <p className="text-lg sm:text-xl text-gray-600 mb-4 px-4">
                        AI-powered resume feedback • Powered by Groq • 100% Free
                    </p>

                    {/* API Status Badge */}
                    <div className="flex justify-center">
                        {checkingApi ? (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                                <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full" />
                                Checking API...
                            </div>
                        ) : apiStatus ? (
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${apiStatus.api_configured
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                <span className={`h-2 w-2 rounded-full ${apiStatus.api_configured ? 'bg-green-500' : 'bg-red-500'
                                    }`} />
                                {apiStatus.api_configured
                                    ? `API Ready (${apiStatus.model || 'Groq'})`
                                    : apiStatus.message || 'API Not Ready'}
                            </div>
                        ) : null}
                    </div>
                </header>

                {/* Main Form */}
                <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 mb-6">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* File Upload */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                📄 Upload Your Resume
                            </label>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".pdf,.docx"
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-gray-600
                    file:mr-4 file:py-3 file:px-6 
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-purple-50 file:text-purple-700
                    hover:file:bg-purple-100
                    cursor-pointer transition-all"
                                />
                            </div>
                            {file && (
                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-700 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="font-medium">{file.name}</span>
                                        <span className="text-green-600">({(file.size / 1024).toFixed(1)} KB)</span>
                                    </p>
                                </div>
                            )}
                            <p className="mt-2 text-xs text-gray-500">
                                Accepted formats: PDF, DOCX (Max 10MB)
                            </p>
                        </div>

                        {/* Job Description */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                💼 Job Description
                            </label>
                            <textarea
                                
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste the complete job description here...

Example:
Senior Software Engineer

We're looking for an experienced software engineer with:
• 5+ years of Python and JavaScript experience
• Strong knowledge of React and Node.js
• Experience with cloud platforms (AWS/GCP)
• Excellent problem-solving skills..."
                                rows={12}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl 
                  focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                  transition resize-none text-sm text-black"
                            />
                            <p className="mt-2 text-xs text-gray-500">
                                {jobDescription.length} characters,  Minimum 50 characters
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                                <div className="flex items-start">
                                    <svg className="w-5 h-5 text-red-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <div>
                                        <p className="font-medium text-red-800">Error</p>
                                        <p className="text-sm text-red-700 mt-1">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !apiStatus?.api_configured}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 
                text-white py-4 px-6 rounded-xl font-semibold text-lg 
                hover:from-purple-700 hover:to-indigo-700 
                disabled:from-gray-400 disabled:to-gray-400 
                disabled:cursor-not-allowed 
                transition-all shadow-lg hover:shadow-xl
                transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-3">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Analyzing Resume...
                                </span>
                            ) : (
                                '🚀 Analyze My Resume'
                            )}
                        </button>

                        {!apiStatus?.api_configured && !checkingApi && (
                            <p className="text-center text-sm text-red-600 flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Backend API is not available. Please check the server.
                            </p>
                        )}
                    </form>
                </div>

                {/* Analysis Results */}
                {analysis && (
                    <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 animate-fade-in">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-4xl">📊</span>
                            <h2 className="text-3xl font-bold text-gray-900">
                                Analysis Results
                            </h2>
                        </div>

                        <div className="prose prose-lg max-w-none">
                            <div className="space-y-1">
                                {formatAnalysis(analysis)}
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setAnalysis('');
                                    setFile(null);
                                    setJobDescription('');
                                }}
                                className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Analyze Another Resume
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <footer className="mt-12 text-center text-sm text-gray-500">
                    <p>Powered by Groq AI • Built with FastAPI & Next.js</p>
                </footer>
            </div>
        </div>
    );
}