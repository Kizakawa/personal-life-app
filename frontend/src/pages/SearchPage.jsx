import { useState } from "react";
import { buildBackendUrl, globalSearch } from "../api/searchApi";

function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch(event) {
    event.preventDefault();

    if (!keyword.trim()) {
      alert("Nhập từ khóa cần tìm.");
      return;
    }

    try {
      setLoading(true);

      const data = await globalSearch(keyword.trim());

      setResults(data);
      setSearched(true);
    } catch (err) {
      console.error(err);
      alert("Tìm kiếm thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <h2>Tìm kiếm toàn cục</h2>
        <p>
          Tìm nhanh trong file upload, dự án, môn học, deadline, kế hoạch ngày,
          người quan trọng, lịch và kho tri thức.
        </p>
      </header>

      <section className="panel">
        <form onSubmit={handleSearch}>
          <label>
            Từ khóa
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Ví dụ: CNN, Colab, báo cáo, lỗi API, xử lý ảnh..."
            />
          </label>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Đang tìm..." : "Tìm kiếm"}
          </button>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading">
          <h3>Kết quả</h3>
        </div>

        {!searched ? (
          <p className="empty">Nhập từ khóa để bắt đầu tìm kiếm.</p>
        ) : results.length === 0 ? (
          <p className="empty">Không tìm thấy dữ liệu phù hợp.</p>
        ) : (
          <div className="event-list">
            {results.map((item, index) => (
              <article
                className="event-card"
                key={`${item.source}-${item.id}-${index}`}
              >
                <div>
                  <h4>{item.title}</h4>

                  <p>
                    {item.sourceLabel || item.source}{" "}
                    {item.subtitle ? `· ${item.subtitle}` : ""}
                  </p>

                  {item.detail && <small>{item.detail}</small>}

                  {item.tags && <small>Tag / liên quan: {item.tags}</small>}

                  {item.url && <small>Link: {item.url}</small>}

                  {item.fileDownloadPath && <small>Có file tải về</small>}
                </div>

                {(item.url || item.fileDownloadPath) && (
                  <div className="card-actions">
                    {item.fileDownloadPath && (
                      <a
                        className="edit-button"
                        href={buildBackendUrl(item.fileDownloadPath)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Tải file
                      </a>
                    )}

                    {item.url && (
                      <a
                        className="secondary-button"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Mở link
                      </a>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default SearchPage;