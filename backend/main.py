from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from groq import Groq
import PyPDF2
import docx
import io
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Resume Analyzer API",
    description="AI-powered resume analysis using Groq",
    version="1.0.0"
)

# CORS Configuration
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://*.vercel.app",
]

# In production, you should set specific origins via environment variable
if os.getenv("FRONTEND_URL"):
    ALLOWED_ORIGINS.append(os.getenv("FRONTEND_URL"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if not os.getenv("ALLOW_ALL_ORIGINS") else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client
def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set")
    return Groq(api_key=api_key)

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading PDF: {str(e)}")

def extract_text_from_docx(file_content: bytes) -> str:
    """Extract text from DOCX file"""
    try:
        doc = docx.Document(io.BytesIO(file_content))
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading DOCX: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Resume Analyzer API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "/analyze": "POST - Analyze resume against job description",
            "/health": "GET - Health check and API status",
            "/docs": "API documentation"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    api_key_present = bool(os.getenv("GROQ_API_KEY"))
    
    status = {
        "status": "healthy" if api_key_present else "unhealthy",
        "api_configured": api_key_present,
        "service": "groq",
        "model": "llama-3.3-70b-versatile"
    }
    
    if not api_key_present:
        status["message"] = "GROQ_API_KEY environment variable is not set"
    else:
        status["message"] = "API is ready"
    
    return status

@app.post("/analyze")
async def analyze_resume(
    resume: UploadFile = File(..., description="Resume file (PDF or DOCX)"),
    job_description: str = Form(..., description="Job description text")
):
    """
    Analyze resume against job description using AI
    
    - **resume**: Upload PDF or DOCX file
    - **job_description**: Paste the job description text
    """
    
    # Validate file type
    if not resume.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    file_extension = resume.filename.lower().split('.')[-1]
    if file_extension not in ['pdf', 'docx']:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Please upload PDF or DOCX"
        )
    
    # Validate job description
    if not job_description or len(job_description.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Job description is too short. Please provide a detailed description."
        )
    
    try:
        # Read file content
        content = await resume.read()
        
        # Extract text based on file type
        if file_extension == 'pdf':
            resume_text = extract_text_from_pdf(content)
        else:  # docx
            resume_text = extract_text_from_docx(content)
        
        # Validate extracted text
        if not resume_text or len(resume_text.strip()) < 100:
            raise HTTPException(
                status_code=400,
                detail="Could not extract sufficient text from resume. Please check your file."
            )
        
        # Truncate for API limits
        resume_text = resume_text[:4000]  # Limit resume text
        job_description = job_description[:2500]  # Limit job description
        
        # Create analysis prompt
        prompt = f"""You are an expert ATS (Applicant Tracking System) and career coach. Analyze this resume against the job description and provide detailed, actionable feedback.

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

Provide a comprehensive analysis with these sections:

1. MATCH SCORE
   - Give a percentage (0-100%) rating
   - Brief explanation of the score

2. KEY STRENGTHS (3-5 points)
   - Skills and experiences that align well
   - Specific examples from the resume

3. GAPS & MISSING SKILLS (3-5 points)
   - Required qualifications not present
   - Skills mentioned in job description but missing from resume

4. ACTIONABLE RECOMMENDATIONS (3-5 points)
   - Specific changes to improve the resume
   - How to better highlight relevant experience
   - Suggestions for formatting or content

5. KEYWORDS TO ADD
   - 5-8 important keywords from the job description
   - Where to incorporate them in the resume

Be specific, constructive, and professional. Focus on actionable advice."""

        # Call Groq API
        client = get_groq_client()
        
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert resume reviewer and career coach with 10+ years of experience in recruitment and ATS optimization."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=2000,
            top_p=1,
        )
        
        analysis = chat_completion.choices[0].message.content
        
        return {
            "success": True,
            "analysis": analysis,
            "metadata": {
                "resume_length": len(resume_text),
                "filename": resume.filename,
                "model_used": "llama-3.3-70b-versatile",
                "service": "groq"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)