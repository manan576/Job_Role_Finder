from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, nullable=False)

    jobs = relationship("Job", back_populates="run")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    company = Column(String, nullable=False)
    title = Column(String, nullable=False)
    url = Column(String, unique=True, nullable=False, index=True)
    status = Column(String, default="pending")
    applied_date = Column(DateTime(timezone=True), nullable=True)
    run_id = Column(Integer, ForeignKey("runs.id"))

    run = relationship("Run", back_populates="jobs")


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    prompt_text = Column(String, nullable=False)
    target_sites = Column(String, nullable=False) # JSON encoded string
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
