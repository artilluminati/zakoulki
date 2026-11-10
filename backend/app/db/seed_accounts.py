"""Создание аккаунтов для защиты/демо."""
from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import hash_password

ACCOUNTS = [
    ("tester", "test@test.ru", "test1234", "admin"),
    ("alice", "alice@test.ru", "test1234", "user"),
    ("bob", "bob@test.ru", "test1234", "user"),
    ("moderator", "mod@test.ru", "test1234", "moderator"),
]

def main():
    db = SessionLocal()
    for username, email, password, role in ACCOUNTS:
        if db.query(User).filter(User.email == email).first():
            continue
        db.add(User(username=username, email=email, password_hash=hash_password(password), role=role))
    db.commit()
    print("accounts ok")

if __name__ == "__main__":
    main()
