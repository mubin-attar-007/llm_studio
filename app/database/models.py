"""ORM models."""
from sqlalchemy import Column, Integer, String, Text

from app.database.sqlite import Base


class Chat(Base):
    __tablename__ = "chats"
    id = Column(String(40), primary_key=True)
    title = Column(String(255), default="New chat")
    messages = Column(Text, default="[]")    # JSON-encoded message list
    created = Column(Integer, default=0)     # ms epoch (matches the frontend)
    updated = Column(Integer, default=0)
    titled = Column(Integer, default=0)
