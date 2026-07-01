import { useEffect, useMemo, useState } from "react";

import {
  createPerson,
  createPersonNote,
  deletePerson,
  deletePersonNote,
  getPeople,
  getPersonNotes,
  markPersonContactToday,
  updatePerson,
} from "../api/peopleApi";
import "./PeoplePage.css";

const today = new Date().toISOString().slice(0, 10);

const initialForm = {
  full_name: "",
  relationship: "",
  relationship_group: "ban_be",
  birthday: "",
  special_date: "",
  special_date_label: "",
  phone: "",
  priority_level: 3,
  closeness_level: "binh_thuong",
  relationship_status: "on_dinh",
  main_contact_channel: "",
  last_contact_date: "",
  likes: "",
  dislikes: "",
  personality_notes: "",
  conversation_notes: "",
  gift_ideas: "",
  gift_budget: "",
  important_notes: "",
  safe_topics: "",
  avoid_topics: "",
  next_action: "",
  privacy_level: "normal",
  reminder_enabled: 0,
  reminder_interval_days: 30,
};

const initialNoteForm = {
  note_date: today,
  title: "",
  content: "",
  mood: "neutral",
  next_action: "",
  is_private: 0,
};

const groupOptions = [
  ["gia_dinh", "Gia đình"],
  ["ban_be", "Bạn bè"],
  ["ban_than", "Bạn thân"],
  ["thay_co", "Thầy cô"],
  ["dong_doi", "Đồng đội"],
  ["dac_biet", "Người đặc biệt"],
  ["khac", "Khác"],
];

const statusOptions = [
  ["on_dinh", "Ổn định"],
  ["it_lien_lac", "Ít liên lạc"],
  ["can_quan_tam", "Cần quan tâm"],
  ["dang_co_van_de", "Đang có vấn đề"],
  ["khong_lam_phien", "Không nên làm phiền"],
];

const closenessOptions = [
  ["xa_la", "Xa lạ"],
  ["quen_biet", "Quen biết"],
  ["binh_thuong", "Bình thường"],
  ["than", "Thân"],
  ["rat_than", "Rất thân"],
];

function optionLabel(options, value) {
  return options.find(([key]) => key === value)?.[1] || "Chưa phân loại";
}

function formatDate(value) {
  if (!value) {
    return "Chưa có";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN");
}

function daysFromToday(value) {
  if (!value) {
    return null;
  }

  const start = new Date(`${today}T00:00:00`);
  const end = new Date(`${value}T00:00:00`);
  return Math.round((end - start) / 86400000);
}

function daysSince(value) {
  const diff = daysFromToday(value);
  return diff === null ? null : Math.max(0, -diff);
}

function daysUntilAnnual(value) {
  if (!value) {
    return null;
  }

  const source = new Date(`${value}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const target = new Date(now.getFullYear(), source.getMonth(), source.getDate());

  if (target < now) {
    target.setFullYear(target.getFullYear() + 1);
  }

  return Math.round((target - now) / 86400000);
}

function buildSuggestion(person) {
  if (!person) {
    return "Chọn một người để xem gợi ý.";
  }

  if (person.next_action) {
    return person.next_action;
  }

  if (person.relationship_status === "khong_lam_phien") {
    return "Nên giữ khoảng cách vừa phải, chỉ nhắn ngắn khi thật cần.";
  }

  if (person.relationship_status === "can_quan_tam") {
    return "Nên hỏi thăm nhẹ, cụ thể, tránh hỏi dồn hoặc tạo áp lực trả lời.";
  }

  const contactGap = daysSince(person.last_contact_date);

  if (contactGap === null) {
    return "Chưa ghi lần liên hệ gần nhất. Có thể bắt đầu bằng một lời hỏi thăm tự nhiên.";
  }

  if (contactGap >= Number(person.reminder_interval_days || 30)) {
    return `Đã ${contactGap} ngày chưa liên hệ. Nên tạo một cuộc trò chuyện ngắn, thân thiện.`;
  }

  return "Quan hệ đang ổn. Chỉ cần duy trì nhịp quan tâm vừa phải.";
}

function toPayload(form) {
  return {
    ...form,
    birthday: form.birthday || null,
    special_date: form.special_date || null,
    last_contact_date: form.last_contact_date || null,
    phone: form.phone || null,
    priority_level: Number(form.priority_level),
    reminder_enabled: form.reminder_enabled ? 1 : 0,
    reminder_interval_days: form.reminder_interval_days
      ? Number(form.reminder_interval_days)
      : null,
    special_date_label: form.special_date_label || null,
    main_contact_channel: form.main_contact_channel || null,
    likes: form.likes || null,
    dislikes: form.dislikes || null,
    personality_notes: form.personality_notes || null,
    conversation_notes: form.conversation_notes || null,
    gift_ideas: form.gift_ideas || null,
    gift_budget: form.gift_budget || null,
    important_notes: form.important_notes || null,
    safe_topics: form.safe_topics || null,
    avoid_topics: form.avoid_topics || null,
    next_action: form.next_action || null,
  };
}

function toForm(person) {
  return {
    ...initialForm,
    ...person,
    birthday: person.birthday || "",
    special_date: person.special_date || "",
    last_contact_date: person.last_contact_date || "",
    special_date_label: person.special_date_label || "",
    phone: person.phone || "",
    likes: person.likes || "",
    dislikes: person.dislikes || "",
    personality_notes: person.personality_notes || "",
    conversation_notes: person.conversation_notes || "",
    gift_ideas: person.gift_ideas || "",
    gift_budget: person.gift_budget || "",
    important_notes: person.important_notes || "",
    safe_topics: person.safe_topics || "",
    avoid_topics: person.avoid_topics || "",
    next_action: person.next_action || "",
    main_contact_channel: person.main_contact_channel || "",
    reminder_enabled: Number(person.reminder_enabled || 0),
    reminder_interval_days: person.reminder_interval_days || 30,
  };
}

function PeoplePage() {
  const [people, setPeople] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [noteForm, setNoteForm] = useState(initialNoteForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortMode, setSortMode] = useState("priority");
  const [error, setError] = useState("");

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedId) || people[0] || null,
    [people, selectedId],
  );

  const filteredPeople = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return [...people]
      .filter((person) => {
        const searchable = [
          person.full_name,
          person.relationship,
          person.likes,
          person.safe_topics,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (!keyword || searchable.includes(keyword)) &&
          (groupFilter === "all" || person.relationship_group === groupFilter) &&
          (statusFilter === "all" || person.relationship_status === statusFilter) &&
          (priorityFilter === "all" ||
            Number(person.priority_level) === Number(priorityFilter))
        );
      })
      .sort((a, b) => {
        if (sortMode === "birthday") {
          return (daysUntilAnnual(a.birthday) ?? 999) - (daysUntilAnnual(b.birthday) ?? 999);
        }

        if (sortMode === "contact") {
          return (daysSince(b.last_contact_date) ?? 999) - (daysSince(a.last_contact_date) ?? 999);
        }

        if (sortMode === "name") {
          return a.full_name.localeCompare(b.full_name, "vi");
        }

        return Number(b.priority_level || 0) - Number(a.priority_level || 0);
      });
  }, [people, search, groupFilter, statusFilter, priorityFilter, sortMode]);

  const stats = useMemo(() => {
    const birthdaysSoon = people.filter((person) => {
      const days = daysUntilAnnual(person.birthday);
      return days !== null && days <= 30;
    }).length;

    const needCare = people.filter(
      (person) =>
        person.relationship_status === "can_quan_tam" ||
        daysSince(person.last_contact_date) >= Number(person.reminder_interval_days || 30),
    ).length;

    const highPriority = people.filter((person) => Number(person.priority_level) >= 4).length;

    return { birthdaysSoon, needCare, highPriority };
  }, [people]);

  async function loadPeople(nextSelectedId = selectedId) {
    try {
      const data = await getPeople();
      setPeople(data);
      setSelectedId(nextSelectedId || data[0]?.id || null);
      setError("");
    } catch {
      setError("Không tải được danh sách người quan trọng.");
    }
  }

  async function loadNotes(personId) {
    if (!personId) {
      setNotes([]);
      return;
    }

    try {
      const data = await getPersonNotes(personId);
      setNotes(data);
    } catch {
      setError("Không tải được timeline ghi chú.");
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  useEffect(() => {
    loadNotes(selectedPerson?.id);
  }, [selectedPerson?.id]);

  function openCreateForm() {
    setEditingId(null);
    setForm(initialForm);
    setIsFormOpen(true);
  }

  function openEditForm(person) {
    setEditingId(person.id);
    setForm(toForm(person));
    setIsFormOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      if (editingId) {
        await updatePerson(editingId, toPayload(form));
        await loadPeople(editingId);
      } else {
        const created = await createPerson(toPayload(form));
        await loadPeople(created.id);
      }

      setIsFormOpen(false);
      setEditingId(null);
      setForm(initialForm);
    } catch {
      setError("Không lưu được thông tin người quan trọng.");
    }
  }

  async function handleDelete(personId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa người này?");

    if (!confirmed) {
      return;
    }

    try {
      await deletePerson(personId);
      await loadPeople(people.find((person) => person.id !== personId)?.id || null);
    } catch {
      setError("Không xóa được người này.");
    }
  }

  async function handleMarkContact(personId) {
    try {
      await markPersonContactToday(personId);
      await loadPeople(personId);
    } catch {
      setError("Không cập nhật được lần liên hệ.");
    }
  }

  async function handleCreateNote(e) {
    e.preventDefault();

    if (!selectedPerson) {
      return;
    }

    try {
      await createPersonNote(selectedPerson.id, {
        ...noteForm,
        content: noteForm.content || null,
        next_action: noteForm.next_action || null,
        is_private: noteForm.is_private ? 1 : 0,
      });
      setNoteForm(initialNoteForm);
      await loadNotes(selectedPerson.id);
    } catch {
      setError("Không lưu được ghi chú timeline.");
    }
  }

  async function handleDeleteNote(noteId) {
    if (!selectedPerson) {
      return;
    }

    try {
      await deletePersonNote(selectedPerson.id, noteId);
      await loadNotes(selectedPerson.id);
    } catch {
      setError("Không xóa được ghi chú.");
    }
  }

  function renderSensitive(label, value) {
    if (!value) {
      return null;
    }

    if (privacyMode && selectedPerson?.privacy_level !== "normal") {
      return (
        <div className="people-detail-line">
          <span>{label}</span>
          <strong>Đang ẩn</strong>
        </div>
      );
    }

    return (
      <div className="people-detail-line">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    );
  }

  return (
    <div className="people-page">
      <header className="people-hero">
        <div>
          <p className="eyebrow">People</p>
          <h2>Người quan trọng</h2>
          <p>
            Sổ tay quan hệ cá nhân: nhớ ngày quan trọng, giữ nhịp liên hệ, ghi
            lại điều nên nói và điều cần tránh.
          </p>
        </div>

        <div className="people-hero-actions">
          <label className="people-privacy-toggle">
            <input
              type="checkbox"
              checked={privacyMode}
              onChange={(e) => setPrivacyMode(e.target.checked)}
            />
            Chế độ riêng tư
          </label>
          <button className="people-primary-button" type="button" onClick={openCreateForm}>
            + Thêm người
          </button>
        </div>
      </header>

      {error && <p className="error-message">{error}</p>}

      <section className="people-stats-grid">
        <article>
          <span>Tổng hồ sơ</span>
          <strong>{people.length}</strong>
        </article>
        <article>
          <span>Sinh nhật 30 ngày tới</span>
          <strong>{stats.birthdaysSoon}</strong>
        </article>
        <article>
          <span>Cần quan tâm</span>
          <strong>{stats.needCare}</strong>
        </article>
        <article>
          <span>Ưu tiên cao</span>
          <strong>{stats.highPriority}</strong>
        </article>
      </section>

      <section className="people-toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên, quan hệ, sở thích..."
        />
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="all">Tất cả nhóm</option>
          {groupOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="all">Mọi ưu tiên</option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              Ưu tiên {value}
            </option>
          ))}
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
          <option value="priority">Sắp theo ưu tiên</option>
          <option value="birthday">Sinh nhật gần nhất</option>
          <option value="contact">Lâu chưa liên hệ</option>
          <option value="name">Tên A-Z</option>
        </select>
      </section>

      <main className="people-layout">
        <section className="people-list-panel">
          {filteredPeople.length === 0 ? (
            <p className="empty">Chưa có người phù hợp bộ lọc.</p>
          ) : (
            <div className="people-card-grid">
              {filteredPeople.map((person) => {
                const birthdayIn = daysUntilAnnual(person.birthday);
                const contactGap = daysSince(person.last_contact_date);

                return (
                  <article
                    className={`people-card ${selectedPerson?.id === person.id ? "active" : ""}`}
                    key={person.id}
                    onClick={() => setSelectedId(person.id)}
                  >
                    <div className="people-card-top">
                      <div className="people-avatar">
                        {person.full_name?.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <h3>{person.full_name}</h3>
                        <p>{person.relationship}</p>
                      </div>
                      <span className={`priority-badge priority-${person.priority_level}`}>
                        Ưu tiên {person.priority_level}
                      </span>
                    </div>

                    <div className="people-card-tags">
                      <span>{optionLabel(groupOptions, person.relationship_group)}</span>
                      <span>{optionLabel(statusOptions, person.relationship_status)}</span>
                      <span>{optionLabel(closenessOptions, person.closeness_level)}</span>
                    </div>

                    <div className="people-card-meta">
                      <span>
                        Sinh nhật:{" "}
                        {birthdayIn === null ? "chưa có" : `${birthdayIn} ngày nữa`}
                      </span>
                      <span>
                        Liên hệ:{" "}
                        {contactGap === null ? "chưa ghi" : `${contactGap} ngày trước`}
                      </span>
                    </div>

                    <p className="people-card-suggestion">{buildSuggestion(person)}</p>

                    <div className="people-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => openEditForm(person)}>
                        Sửa
                      </button>
                      <button type="button" onClick={() => handleMarkContact(person.id)}>
                        Đã liên hệ
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => handleDelete(person.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="people-detail-panel">
          {!selectedPerson ? (
            <p className="empty">Chọn một người để xem chi tiết.</p>
          ) : (
            <>
              <div className="people-detail-header">
                <div className="people-avatar large">
                  {selectedPerson.full_name?.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3>{selectedPerson.full_name}</h3>
                  <p>{selectedPerson.relationship}</p>
                </div>
              </div>

              <div className="people-insight">
                <span>Gợi ý hôm nay</span>
                <p>{buildSuggestion(selectedPerson)}</p>
              </div>

              <div className="people-detail-grid">
                <div className="people-detail-line">
                  <span>Nhóm</span>
                  <strong>{optionLabel(groupOptions, selectedPerson.relationship_group)}</strong>
                </div>
                <div className="people-detail-line">
                  <span>Trạng thái</span>
                  <strong>{optionLabel(statusOptions, selectedPerson.relationship_status)}</strong>
                </div>
                <div className="people-detail-line">
                  <span>Sinh nhật</span>
                  <strong>{formatDate(selectedPerson.birthday)}</strong>
                </div>
                <div className="people-detail-line">
                  <span>Lần cuối liên hệ</span>
                  <strong>{formatDate(selectedPerson.last_contact_date)}</strong>
                </div>
                {renderSensitive("Sở thích", selectedPerson.likes)}
                {renderSensitive("Không thích", selectedPerson.dislikes)}
                {renderSensitive("Nên nói", selectedPerson.safe_topics)}
                {renderSensitive("Nên tránh", selectedPerson.avoid_topics)}
                {renderSensitive("Cách trò chuyện", selectedPerson.conversation_notes)}
                {renderSensitive("Gợi ý quà", selectedPerson.gift_ideas)}
              </div>

              <form className="people-note-form" onSubmit={handleCreateNote}>
                <h4>Thêm ghi chú timeline</h4>
                <div className="people-form-row">
                  <input
                    type="date"
                    value={noteForm.note_date}
                    onChange={(e) => setNoteForm({ ...noteForm, note_date: e.target.value })}
                    required
                  />
                  <select
                    value={noteForm.mood}
                    onChange={(e) => setNoteForm({ ...noteForm, mood: e.target.value })}
                  >
                    <option value="positive">Tích cực</option>
                    <option value="neutral">Bình thường</option>
                    <option value="sensitive">Nhạy cảm</option>
                    <option value="important">Quan trọng</option>
                  </select>
                </div>
                <input
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  placeholder="Tiêu đề ghi chú"
                  required
                />
                <textarea
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  placeholder="Chuyện đã xảy ra, điều cần nhớ..."
                />
                <input
                  value={noteForm.next_action}
                  onChange={(e) => setNoteForm({ ...noteForm, next_action: e.target.value })}
                  placeholder="Hành động tiếp theo nếu có"
                />
                <label className="people-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(noteForm.is_private)}
                    onChange={(e) =>
                      setNoteForm({ ...noteForm, is_private: e.target.checked ? 1 : 0 })
                    }
                  />
                  Ghi chú riêng tư
                </label>
                <button className="people-primary-button" type="submit">
                  Lưu ghi chú
                </button>
              </form>

              <div className="people-timeline">
                <h4>Timeline</h4>
                {notes.length === 0 ? (
                  <p className="empty">Chưa có ghi chú timeline.</p>
                ) : (
                  notes.map((note) => {
                    const hidden = privacyMode && note.is_private;

                    return (
                      <article className={`timeline-item mood-${note.mood}`} key={note.id}>
                        <div>
                          <span>{formatDate(note.note_date)}</span>
                          <h5>{hidden ? "Ghi chú riêng tư" : note.title}</h5>
                          {!hidden && note.content && <p>{note.content}</p>}
                          {!hidden && note.next_action && (
                            <small>Tiếp theo: {note.next_action}</small>
                          )}
                        </div>
                        <button type="button" onClick={() => handleDeleteNote(note.id)}>
                          Xóa
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </>
          )}
        </aside>
      </main>

      {isFormOpen && (
        <div className="people-modal-backdrop" role="presentation">
          <form className="people-modal" onSubmit={handleSubmit}>
            <div className="people-modal-header">
              <div>
                <p className="eyebrow">Relationship profile</p>
                <h3>{editingId ? "Sửa hồ sơ" : "Thêm người quan trọng"}</h3>
              </div>
              <button type="button" onClick={() => setIsFormOpen(false)}>
                Đóng
              </button>
            </div>

            <div className="people-form-grid">
              <label>
                Họ tên
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </label>
              <label>
                Mối quan hệ
                <input
                  value={form.relationship}
                  onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                  required
                />
              </label>
              <label>
                Nhóm quan hệ
                <select
                  value={form.relationship_group}
                  onChange={(e) => setForm({ ...form, relationship_group: e.target.value })}
                >
                  {groupOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mức ưu tiên
                <select
                  value={form.priority_level}
                  onChange={(e) => setForm({ ...form, priority_level: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mức thân thiết
                <select
                  value={form.closeness_level}
                  onChange={(e) => setForm({ ...form, closeness_level: e.target.value })}
                >
                  {closenessOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Trạng thái quan hệ
                <select
                  value={form.relationship_status}
                  onChange={(e) => setForm({ ...form, relationship_status: e.target.value })}
                >
                  {statusOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sinh nhật
                <input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                />
              </label>
              <label>
                Ngày đặc biệt
                <input
                  type="date"
                  value={form.special_date}
                  onChange={(e) => setForm({ ...form, special_date: e.target.value })}
                />
              </label>
              <label>
                Tên ngày đặc biệt
                <input
                  value={form.special_date_label}
                  onChange={(e) => setForm({ ...form, special_date_label: e.target.value })}
                  placeholder="Ngày quen nhau, ngày cảm ơn..."
                />
              </label>
              <label>
                Lần cuối liên hệ
                <input
                  type="date"
                  value={form.last_contact_date}
                  onChange={(e) => setForm({ ...form, last_contact_date: e.target.value })}
                />
              </label>
              <label>
                Kênh liên hệ chính
                <input
                  value={form.main_contact_channel}
                  onChange={(e) => setForm({ ...form, main_contact_channel: e.target.value })}
                  placeholder="Zalo, Messenger, gặp trực tiếp..."
                />
              </label>
              <label>
                Số điện thoại
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                Ngân sách quà
                <input
                  value={form.gift_budget}
                  onChange={(e) => setForm({ ...form, gift_budget: e.target.value })}
                  placeholder="Dưới 100k, 100k-300k..."
                />
              </label>
              <label>
                Mức riêng tư
                <select
                  value={form.privacy_level}
                  onChange={(e) => setForm({ ...form, privacy_level: e.target.value })}
                >
                  <option value="normal">Bình thường</option>
                  <option value="private">Riêng tư</option>
                  <option value="secret">Rất riêng tư</option>
                </select>
              </label>
              <label>
                Chu kỳ nhắc liên hệ
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.reminder_interval_days}
                  onChange={(e) =>
                    setForm({ ...form, reminder_interval_days: Number(e.target.value) })
                  }
                />
              </label>
            </div>

            <div className="people-textarea-grid">
              <label>
                Sở thích
                <textarea
                  value={form.likes}
                  onChange={(e) => setForm({ ...form, likes: e.target.value })}
                />
              </label>
              <label>
                Điều không thích
                <textarea
                  value={form.dislikes}
                  onChange={(e) => setForm({ ...form, dislikes: e.target.value })}
                />
              </label>
              <label>
                Tính cách
                <textarea
                  value={form.personality_notes}
                  onChange={(e) => setForm({ ...form, personality_notes: e.target.value })}
                />
              </label>
              <label>
                Cách trò chuyện
                <textarea
                  value={form.conversation_notes}
                  onChange={(e) => setForm({ ...form, conversation_notes: e.target.value })}
                />
              </label>
              <label>
                Chủ đề nên nói
                <textarea
                  value={form.safe_topics}
                  onChange={(e) => setForm({ ...form, safe_topics: e.target.value })}
                />
              </label>
              <label>
                Chủ đề nên tránh
                <textarea
                  value={form.avoid_topics}
                  onChange={(e) => setForm({ ...form, avoid_topics: e.target.value })}
                />
              </label>
              <label>
                Gợi ý quà
                <textarea
                  value={form.gift_ideas}
                  onChange={(e) => setForm({ ...form, gift_ideas: e.target.value })}
                />
              </label>
              <label>
                Hành động tiếp theo
                <textarea
                  value={form.next_action}
                  onChange={(e) => setForm({ ...form, next_action: e.target.value })}
                />
              </label>
              <label>
                Ghi chú quan trọng
                <textarea
                  value={form.important_notes}
                  onChange={(e) => setForm({ ...form, important_notes: e.target.value })}
                />
              </label>
            </div>

            <label className="people-checkbox">
              <input
                type="checkbox"
                checked={Boolean(form.reminder_enabled)}
                onChange={(e) =>
                  setForm({ ...form, reminder_enabled: e.target.checked ? 1 : 0 })
                }
              />
              Bật nhắc giữ liên hệ
            </label>

            <div className="people-modal-actions">
              <button className="people-secondary-button" type="button" onClick={() => setIsFormOpen(false)}>
                Hủy
              </button>
              <button className="people-primary-button" type="submit">
                {editingId ? "Cập nhật" : "Lưu hồ sơ"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default PeoplePage;
