"""ORM models."""
from sqlalchemy import BigInteger, Column, Integer, String, Text

from app.database.engine import Base


class User(Base):
    __tablename__ = "users"
    id = Column(String(40), primary_key=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(120), default="")
    role = Column(String(20), default="user")        # "user" | "admin"
    is_active = Column(Integer, default=1)
    created = Column(BigInteger, default=0)          # ms epoch (needs 64-bit on Postgres)


class Session(Base):
    __tablename__ = "sessions"
    id = Column(String(64), primary_key=True)        # opaque session token
    user_id = Column(String(40), nullable=False, index=True)
    created = Column(BigInteger, default=0)
    expires = Column(BigInteger, default=0, index=True)
    last_seen = Column(BigInteger, default=0)


class PasswordReset(Base):
    __tablename__ = "password_resets"
    token = Column(String(64), primary_key=True)     # opaque single-use reset token
    user_id = Column(String(40), nullable=False, index=True)
    expires = Column(BigInteger, default=0, index=True)


class UsageDaily(Base):
    __tablename__ = "usage_daily"
    user_id = Column(String(40), primary_key=True)
    day = Column(Integer, primary_key=True)          # YYYYMMDD (UTC) — fits in 32-bit
    count = Column(Integer, default=0)


class Chat(Base):
    __tablename__ = "chats"
    id = Column(String(40), primary_key=True)
    owner_id = Column(String(40), index=True)        # users.id (logical FK; scoped in the repo)
    title = Column(String(255), default="New chat")
    messages = Column(Text, default="[]")            # JSON-encoded message list
    created = Column(BigInteger, default=0)          # ms epoch (matches the frontend)
    updated = Column(BigInteger, default=0)
    titled = Column(Integer, default=0)
