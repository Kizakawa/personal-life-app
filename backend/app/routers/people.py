from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.person import Person, PersonNote
from app.schemas.person import (
    PersonCreate,
    PersonNoteCreate,
    PersonNoteResponse,
    PersonNoteUpdate,
    PersonResponse,
    PersonUpdate,
)

router = APIRouter(prefix="/people", tags=["People"])


PEOPLE_SCHEMA_COLUMNS = {
    "relationship_group": "VARCHAR",
    "closeness_level": "VARCHAR",
    "relationship_status": "VARCHAR",
    "main_contact_channel": "VARCHAR",
    "last_contact_date": "DATE",
    "special_date": "DATE",
    "special_date_label": "VARCHAR",
    "gift_budget": "VARCHAR",
    "safe_topics": "TEXT",
    "avoid_topics": "TEXT",
    "next_action": "TEXT",
    "privacy_level": "VARCHAR",
    "reminder_enabled": "INTEGER NOT NULL DEFAULT 0",
    "reminder_interval_days": "INTEGER DEFAULT 30",
}


def ensure_people_schema(db: Session):
    inspector = inspect(db.bind)

    if "people" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("people")}

    for column_name, column_type in PEOPLE_SCHEMA_COLUMNS.items():
        if column_name not in existing_columns:
            db.execute(text(f"ALTER TABLE people ADD COLUMN {column_name} {column_type}"))

    db.commit()


def get_person_or_404(person_id: int, db: Session):
    person = db.query(Person).filter(Person.id == person_id).first()

    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")

    return person


@router.get("", response_model=list[PersonResponse])
def get_people(db: Session = Depends(get_db)):
    ensure_people_schema(db)
    return (
        db.query(Person)
        .order_by(Person.priority_level.desc(), Person.full_name)
        .all()
    )


@router.post("", response_model=PersonResponse)
def create_person(person: PersonCreate, db: Session = Depends(get_db)):
    ensure_people_schema(db)
    new_person = Person(**person.model_dump())
    db.add(new_person)
    db.commit()
    db.refresh(new_person)
    return new_person


@router.put("/{person_id}", response_model=PersonResponse)
def update_person(
    person_id: int,
    person_data: PersonUpdate,
    db: Session = Depends(get_db),
):
    ensure_people_schema(db)
    person = get_person_or_404(person_id, db)

    for key, value in person_data.model_dump().items():
        setattr(person, key, value)

    db.commit()
    db.refresh(person)
    return person


@router.delete("/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db)):
    ensure_people_schema(db)
    person = get_person_or_404(person_id, db)

    db.delete(person)
    db.commit()

    return {
        "message": "Person deleted successfully",
        "id": person_id,
    }


@router.post("/{person_id}/contact-today", response_model=PersonResponse)
def mark_contact_today(person_id: int, db: Session = Depends(get_db)):
    ensure_people_schema(db)
    person = get_person_or_404(person_id, db)
    person.last_contact_date = date.today()

    db.commit()
    db.refresh(person)
    return person


@router.get("/{person_id}/notes", response_model=list[PersonNoteResponse])
def get_person_notes(person_id: int, db: Session = Depends(get_db)):
    get_person_or_404(person_id, db)

    return (
        db.query(PersonNote)
        .filter(PersonNote.person_id == person_id)
        .order_by(PersonNote.note_date.desc(), PersonNote.id.desc())
        .all()
    )


@router.post("/{person_id}/notes", response_model=PersonNoteResponse)
def create_person_note(
    person_id: int,
    note: PersonNoteCreate,
    db: Session = Depends(get_db),
):
    get_person_or_404(person_id, db)

    new_note = PersonNote(person_id=person_id, **note.model_dump())
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note


@router.put("/{person_id}/notes/{note_id}", response_model=PersonNoteResponse)
def update_person_note(
    person_id: int,
    note_id: int,
    note_data: PersonNoteUpdate,
    db: Session = Depends(get_db),
):
    get_person_or_404(person_id, db)
    note = (
        db.query(PersonNote)
        .filter(PersonNote.id == note_id, PersonNote.person_id == person_id)
        .first()
    )

    if note is None:
        raise HTTPException(status_code=404, detail="Person note not found")

    for key, value in note_data.model_dump().items():
        setattr(note, key, value)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{person_id}/notes/{note_id}")
def delete_person_note(person_id: int, note_id: int, db: Session = Depends(get_db)):
    get_person_or_404(person_id, db)
    note = (
        db.query(PersonNote)
        .filter(PersonNote.id == note_id, PersonNote.person_id == person_id)
        .first()
    )

    if note is None:
        raise HTTPException(status_code=404, detail="Person note not found")

    db.delete(note)
    db.commit()

    return {
        "message": "Person note deleted successfully",
        "id": note_id,
    }
