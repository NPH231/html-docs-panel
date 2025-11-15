import React, { useEffect, useState, useRef } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";

const ADMIN_PASSWORD = "admin123"; // đổi mật khẩu admin ở đây

// Cloudinary config
const CLOUDINARY_CLOUD_NAME = "dpdw1xx4x";
const CLOUDINARY_UPLOAD_PRESET = "docs_unsigned";

// upload file lên Cloudinary (ảnh + pdf + ảnh blog)
async function uploadToCloudinary(file, folder) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append("folder", folder);

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Cloudinary error:", data);
    alert("Cloudinary error: " + (data.error?.message || "unknown"));
    throw new Error(data.error?.message || "Upload Cloudinary thất bại");
  }

  return data.secure_url;
}

// helper: nhận diện note có phải URL không
const isProbablyUrl = (text) => {
  if (!text) return false;
  return /^https?:\/\//i.test(text.trim());
};

// type docs: 'html' | 'url' | 'pdf' | 'images'

function App() {
  const [docs, setDocs] = useState([]); // tài liệu
  const [tab, setTab] = useState("admin"); // 'admin' | 'viewer'

  // HTML
  const [pendingFile, setPendingFile] = useState(null); // {name, content}
  const [passwordInput, setPasswordInput] = useState("");
  const [noteHtml, setNoteHtml] = useState("");

  // PDF (Cloudinary)
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPasswordInput, setPdfPasswordInput] = useState("");
  const [notePdf, setNotePdf] = useState("");

  // URL
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [noteUrl, setNoteUrl] = useState("");

  // IMAGE DOC (nhiều ảnh)
  const [imagesName, setImagesName] = useState("");
  const [imagesFiles, setImagesFiles] = useState([]);
  const [imagesPasswordInput, setImagesPasswordInput] = useState("");
  const [noteImages, setNoteImages] = useState("");

  // Viewer tài liệu
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [viewPassword, setViewPassword] = useState("");
  const [viewError, setViewError] = useState("");
  const [unlockedDoc, setUnlockedDoc] = useState(null);
  const [fullView, setFullView] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1); // zoom cho tài liệu ảnh
  const [imageOffsetX, setImageOffsetX] = useState(0); // offset ngang cho mobile
  const imagesWrapperRef = useRef(null); // vùng chứa ảnh

  // Admin auth
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [adminPwInput, setAdminPwInput] = useState("");
  const [adminError, setAdminError] = useState("");

  // Edit document
  const [editingDocId, setEditingDocId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editUrl, setEditUrl] = useState("");

  // Mobile
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [mobileShowSidebar, setMobileShowSidebar] = useState(false);

  // =============== ĐỀ THI ===============
  const [exams, setExams] = useState([]); // {id, semester, subject, examName, answers, imageUrls?, createdAt}
  const [semesterInput, setSemesterInput] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  const [examNameInput, setExamNameInput] = useState("");
  const [answersInput, setAnswersInput] = useState("");
  const [examImagesFiles, setExamImagesFiles] = useState([]); // ảnh đề thi
  const [editingExamId, setEditingExamId] = useState(null);
  const [editSemester, setEditSemester] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editExamName, setEditExamName] = useState("");
  const [editAnswers, setEditAnswers] = useState("");
  const [openExamId, setOpenExamId] = useState(null);

  // =============== BLOG ===============
  const [blogs, setBlogs] = useState([]); // {id, title, content, tags[], createdAt}
  const [blogTitle, setBlogTitle] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [blogTagsInput, setBlogTagsInput] = useState("");
  const [blogSearch, setBlogSearch] = useState("");
  const [activeBlogTag, setActiveBlogTag] = useState(null);
  const [activeBlogId, setActiveBlogId] = useState(null); // blog đang xem chi tiết
  const blogContentRef = useRef(null);
  const [isBlogImageUploading, setIsBlogImageUploading] = useState(false);

  // edit blog
  const [editingBlogId, setEditingBlogId] = useState(null);
  const [editBlogTitle, setEditBlogTitle] = useState("");
  const [editBlogContent, setEditBlogContent] = useState("");
  const [editBlogTagsInput, setEditBlogTagsInput] = useState("");

  // responsive
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileShowSidebar(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Load docs real-time
  useEffect(() => {
    const q = query(collection(db, "docs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setDocs(items);
    });
    return () => unsub();
  }, []);

  // Load exams real-time
  useEffect(() => {
    const q = query(collection(db, "exams"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setExams(items);
    });
    return () => unsub();
  }, []);

  // Load blogs real-time
  useEffect(() => {
    const q = query(collection(db, "blogs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setBlogs(items);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setFullView(false);
    setViewerZoom(1); // reset zoom khi đổi tài liệu
    setImageOffsetX(0); // reset offset ngang khi đổi tài liệu
  }, [selectedDocId]);

  const currentSelectedDoc =
    docs.find((d) => d.id === selectedDocId) || null;

  // ---------- Upload HTML ----------
  const handleHtmlFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingFile({
        name: file.name,
        content: reader.result,
      });
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const handleSaveHtml = async (e) => {
    e.preventDefault();
    if (!pendingFile || !passwordInput.trim()) return;

    await addDoc(collection(db, "docs"), {
      name: pendingFile.name,
      type: "html",
      content: pendingFile.content,
      password: passwordInput.trim(),
      note: noteHtml.trim() || null,
      createdAt: Date.now(),
    });

    setPendingFile(null);
    setPasswordInput("");
    setNoteHtml("");
    alert("Lưu tài liệu HTML (online) thành công!");
  };

  // ---------- Upload PDF via Cloudinary ----------
  const handlePdfFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Chỉ hỗ trợ file PDF (.pdf)");
      return;
    }
    setPdfFile(file);
    e.target.value = "";
  };

  const handleSavePdf = async (e) => {
    e.preventDefault();
    if (!pdfFile || !pdfPasswordInput.trim()) return;

    try {
      const pdfUrl = await uploadToCloudinary(pdfFile, "pdfs");

      await addDoc(collection(db, "docs"), {
        name: pdfFile.name,
        type: "pdf",
        pdfUrl,
        password: pdfPasswordInput.trim(),
        note: notePdf.trim() || null,
        createdAt: Date.now(),
      });

      setPdfFile(null);
      setPdfPasswordInput("");
      setNotePdf("");
      alert("Upload PDF lên Cloudinary + lưu online thành công!");
    } catch (err) {
      console.error(err);
      alert("Lỗi upload PDF lên Cloudinary. Kiểm tra cloud_name / preset.");
    }
  };

  // ---------- Upload URL ----------
  const handleSaveLinkDoc = async (e) => {
    e.preventDefault();
    if (!linkName.trim() || !linkUrl.trim() || !linkPassword.trim()) return;

    await addDoc(collection(db, "docs"), {
      name: linkName.trim(),
      type: "url",
      url: linkUrl.trim(),
      password: linkPassword.trim(),
      note: noteUrl.trim() || null,
      createdAt: Date.now(),
    });

    setLinkName("");
    setLinkUrl("");
    setLinkPassword("");
    setNoteUrl("");
    alert("Lưu tài liệu URL (online) thành công!");
  };

  // ---------- Upload IMAGE DOC ----------
  const handleImagesFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (!valid.length) {
      alert("Chỉ hỗ trợ file ảnh (jpg, png, webp, ...)");
      e.target.value = "";
      return;
    }
    setImagesFiles(valid);
    e.target.value = "";
  };

  const handleSaveImagesDoc = async (e) => {
    e.preventDefault();
    if (!imagesFiles.length || !imagesPasswordInput.trim()) return;

    try {
      const imageUrls = [];
      for (let i = 0; i < imagesFiles.length; i++) {
        const file = imagesFiles[i];
        const url = await uploadToCloudinary(file, "imageDocs");
        imageUrls.push(url);
      }

      const nameFromInput = imagesName.trim();
      const nameFallback =
        imagesFiles[0]?.name || `Bộ ảnh ${new Date().toLocaleString("vi-VN")}`;

      await addDoc(collection(db, "docs"), {
        name: nameFromInput || nameFallback,
        type: "images",
        imageUrls,
        password: imagesPasswordInput.trim(),
        note: noteImages.trim() || null,
        createdAt: Date.now(),
      });

      setImagesName("");
      setImagesFiles([]);
      setImagesPasswordInput("");
      setNoteImages("");
      alert("Upload bộ ảnh lên Cloudinary + lưu online thành công!");
    } catch (err) {
      console.error(err);
      alert("Lỗi upload bộ ảnh lên Cloudinary. Kiểm tra config.");
    }
  };

  // ---------- Admin login ----------
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPwInput === ADMIN_PASSWORD) {
      setIsAdminAuthed(true);
      setAdminError("");
    } else {
      setAdminError("Sai mật khẩu admin.");
    }
  };

  // ---------- Viewer tài liệu ----------
  const handleCheckPassword = (e) => {
    e.preventDefault();
    if (!currentSelectedDoc) return;
    if (viewPassword === currentSelectedDoc.password) {
      setUnlockedDoc(currentSelectedDoc);
      setViewError("");
    } else {
      setUnlockedDoc(null);
      setViewError("Sai mật khẩu, vui lòng thử lại.");
    }
  };

  const handleDeleteDoc = async (id) => {
    await deleteDoc(doc(db, "docs", id));
    if (selectedDocId === id) {
      setSelectedDocId(null);
      setUnlockedDoc(null);
      setViewPassword("");
      setViewError("");
    }
    if (editingDocId === id) {
      setEditingDocId(null);
      setEditName("");
      setEditPassword("");
      setEditNote("");
      setEditUrl("");
    }
  };

  const openInNewTab = () => {
    if (!unlockedDoc) return;

    if (unlockedDoc.type === "url" && unlockedDoc.url) {
      window.open(unlockedDoc.url, "_blank");
      return;
    }
    if (unlockedDoc.type === "html" && unlockedDoc.content) {
      const blob = new Blob([unlockedDoc.content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      return;
    }
    if (unlockedDoc.type === "pdf" && unlockedDoc.pdfUrl) {
      window.open(unlockedDoc.pdfUrl, "_blank");
      return;
    }
    if (unlockedDoc.type === "images" && unlockedDoc.imageUrls?.length) {
      window.open(unlockedDoc.imageUrls[0], "_blank");
      return;
    }
  };

  // nút qua trái / qua phải cho tài liệu ảnh
  const scrollImages = (direction) => {
    const el = imagesWrapperRef.current;
    if (!el) return;

    if (isMobile) {
      // Trên mobile: dùng translateX
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;

      const base = 0.3; // 30% chiều rộng mỗi lần bấm
      const step = el.clientWidth * base;

      setImageOffsetX((prev) => {
        const delta = direction === "left" ? step : -step;
        let next = prev + delta;

        const min = -maxScroll;
        const max = 0;

        if (next > max) next = max;
        if (next < min) next = min;
        return next;
      });
    } else {
      // Desktop: dùng scroll ngang
      const base = 0.6;
      const delta = el.clientWidth * base;
      const dx = direction === "left" ? -delta : delta;

      el.scrollBy({
        left: dx,
        behavior: "smooth",
      });
    }
  };

  // ---------- Edit document ----------
  const startEditDoc = (docItem) => {
    setEditingDocId(docItem.id);
    setEditName(docItem.name || "");
    setEditPassword(docItem.password || "");
    setEditNote(docItem.note || "");
    setEditUrl(docItem.type === "url" ? docItem.url || "" : "");
  };

  const cancelEditDoc = () => {
    setEditingDocId(null);
    setEditName("");
    setEditPassword("");
    setEditNote("");
    setEditUrl("");
  };

  const handleUpdateDoc = async (e) => {
    e.preventDefault();
    if (!editingDocId) return;
    const docItem = docs.find((d) => d.id === editingDocId);
    if (!docItem) return;

    const payload = {};
    const newName = editName.trim();
    const newPw = editPassword.trim();
    const newNote = editNote.trim();
    const newUrl = editUrl.trim();

    if (newName && newName !== docItem.name) payload.name = newName;
    if (newPw && newPw !== docItem.password) payload.password = newPw;
    payload.note = newNote || null;

    if (docItem.type === "url" && newUrl && newUrl !== docItem.url) {
      payload.url = newUrl;
    }

    try {
      await updateDoc(doc(db, "docs", editingDocId), payload);
      alert("Cập nhật tài liệu thành công!");
      cancelEditDoc();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi cập nhật tài liệu.");
    }
  };

  // ---------- ĐỀ THI: CRUD + ẢNH ĐỀ ----------

  const handleExamImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (!valid.length) {
      alert("Chỉ hỗ trợ file ảnh cho đề thi.");
      e.target.value = "";
      return;
    }
    setExamImagesFiles(valid);
    e.target.value = "";
  };

  const handleSaveExam = async (e) => {
    e.preventDefault();
    if (!semesterInput.trim() || !subjectInput.trim() || !examNameInput.trim())
      return;

    try {
      let imageUrls = [];
      if (examImagesFiles.length) {
        for (const file of examImagesFiles) {
          const url = await uploadToCloudinary(file, "examImages");
          imageUrls.push(url);
        }
      }

      await addDoc(collection(db, "exams"), {
        semester: semesterInput.trim(),
        subject: subjectInput.trim(),
        examName: examNameInput.trim(),
        answers: answersInput.trim() || "",
        imageUrls,
        createdAt: Date.now(),
      });

      setSemesterInput("");
      setSubjectInput("");
      setExamNameInput("");
      setAnswersInput("");
      setExamImagesFiles([]);
      alert("Thêm đề thi thành công!");
    } catch (err) {
      console.error(err);
      alert("Lỗi khi lưu đề thi (upload ảnh hoặc Firestore).");
    }
  };

  const handleDeleteExam = async (id) => {
    await deleteDoc(doc(db, "exams", id));
    if (editingExamId === id) {
      setEditingExamId(null);
      setEditSemester("");
      setEditSubject("");
      setEditExamName("");
      setEditAnswers("");
    }
    if (openExamId === id) setOpenExamId(null);
  };

  const startEditExam = (exam) => {
    setEditingExamId(exam.id);
    setEditSemester(exam.semester || "");
    setEditSubject(exam.subject || "");
    setEditExamName(exam.examName || "");
    setEditAnswers(exam.answers || "");
  };

  const cancelEditExam = () => {
    setEditingExamId(null);
    setEditSemester("");
    setEditSubject("");
    setEditExamName("");
    setEditAnswers("");
  };

  const handleUpdateExam = async (e) => {
    e.preventDefault();
    if (!editingExamId) return;
    const exam = exams.find((ex) => ex.id === editingExamId);
    if (!exam) return;

    const payload = {
      semester: editSemester.trim() || exam.semester,
      subject: editSubject.trim() || exam.subject,
      examName: editExamName.trim() || exam.examName,
      answers: editAnswers.trim(),
      // hiện tại không sửa imageUrls để đơn giản
    };

    try {
      await updateDoc(doc(db, "exams", editingExamId), payload);
      alert("Cập nhật đề thi thành công!");
      cancelEditExam();
    } catch (err) {
      console.error(err);
      alert("Lỗi cập nhật đề thi.");
    }
  };

  // group exams theo kỳ / môn
  const groupedExams = exams.reduce((acc, ex) => {
    const sem = ex.semester || "Khác";
    const sub = ex.subject || "Khác";
    if (!acc[sem]) acc[sem] = {};
    if (!acc[sem][sub]) acc[sem][sub] = [];
    acc[sem][sub].push(ex);
    return acc;
  }, {});

  // ---------- BLOG: CRUD + toolbar + filter + edit ----------

  // toolbar apply format cho blogContent
  const applyBlogFormat = (type) => {
    const textarea = blogContentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const value = blogContent;
    const selected = value.slice(start, end) || "";

    let before = value.slice(0, start);
    let after = value.slice(end);
    let insert = "";
    let cursorStart, cursorEnd;

    if (type === "bold") {
      const text = selected || "văn bản đậm";
      insert = `**${text}**`;
      cursorStart = before.length + 2;
      cursorEnd = before.length + 2 + text.length;
    } else if (type === "italic") {
      const text = selected || "nghiêng";
      insert = `*${text}*`;
      cursorStart = before.length + 1;
      cursorEnd = before.length + 1 + text.length;
    } else if (type === "code") {
      const text = selected || "code";
      insert = `\`${text}\``;
      cursorStart = before.length + 1;
      cursorEnd = before.length + 1 + text.length;
    } else if (type === "h2") {
      const text = selected || "Tiêu đề";
      insert = `\n## ${text}\n`;
      cursorStart = before.length + 4;
      cursorEnd = before.length + 4 + text.length;
    } else if (type === "ul") {
      const text = selected || "mục 1\nmục 2";
      const lines = text
        .split("\n")
        .map((l) => (l ? `- ${l}` : "- "));
      insert = `\n${lines.join("\n")}\n`;
      cursorStart = before.length + 2;
      cursorEnd = before.length + insert.length - 1;
    } else if (type === "codeblock") {
      const text = selected || "code ở đây";
      insert = `\n\`\`\`\n${text}\n\`\`\`\n`;
      cursorStart = before.length + 4;
      cursorEnd = before.length + 4 + text.length;
    } else {
      return;
    }

    const newValue = before + insert + after;
    setBlogContent(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const handleInsertImage = () => {
    if (isBlogImageUploading) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setIsBlogImageUploading(true);
        const url = await uploadToCloudinary(file, "blogImages");
        if (!url) return;
        setBlogContent((prev) => `${prev}\n![](${url})\n`);
      } catch (err) {
        console.error(err);
        alert("Upload ảnh blog thất bại!");
      } finally {
        setIsBlogImageUploading(false);
      }
    };

    input.click();
  };

  const handleSaveBlog = async (e) => {
    e.preventDefault();
    if (!blogTitle.trim() || !blogContent.trim()) return;

    const tags =
      blogTagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean) || [];

    await addDoc(collection(db, "blogs"), {
      title: blogTitle.trim(),
      content: blogContent.trim(),
      tags,
      createdAt: Date.now(),
    });

    setBlogTitle("");
    setBlogContent("");
    setBlogTagsInput("");
    alert("Thêm blog thành công!");
  };

  const startEditBlog = (blog) => {
    setEditingBlogId(blog.id);
    setEditBlogTitle(blog.title || "");
    setEditBlogContent(blog.content || "");
    setEditBlogTagsInput(
      Array.isArray(blog.tags) ? blog.tags.join(", ") : ""
    );
  };

  const cancelEditBlog = () => {
    setEditingBlogId(null);
    setEditBlogTitle("");
    setEditBlogContent("");
    setEditBlogTagsInput("");
  };

  const handleUpdateBlog = async (e) => {
    e.preventDefault();
    if (!editingBlogId) return;

    const blog = blogs.find((b) => b.id === editingBlogId);
    if (!blog) return;

    const tags =
      editBlogTagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean) || [];

    const payload = {
      title: editBlogTitle.trim() || blog.title,
      content: editBlogContent.trim() || blog.content,
      tags,
    };

    try {
      await updateDoc(doc(db, "blogs", editingBlogId), payload);
      alert("Cập nhật blog thành công!");
      cancelEditBlog();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi cập nhật blog.");
    }
  };

  const handleDeleteBlog = async (id) => {
    await deleteDoc(doc(db, "blogs", id));
    if (activeBlogId === id) setActiveBlogId(null);
    if (editingBlogId === id) cancelEditBlog();
  };

  const allBlogTags = Array.from(
    new Set(
      blogs.flatMap((b) => (Array.isArray(b.tags) ? b.tags : [])).filter(
        Boolean
      )
    )
  );

  const filteredBlogs = blogs.filter((b) => {
    const text = (b.title + " " + b.content).toLowerCase();
    const searchOk = !blogSearch.trim()
      ? true
      : text.includes(blogSearch.trim().toLowerCase());
    const tagOk = !activeBlogTag ? true : (b.tags || []).includes(activeBlogTag);
    return searchOk && tagOk;
  });

  const activeBlog =
    activeBlogId != null ? blogs.find((b) => b.id === activeBlogId) : null;

  const appRootStyle = {
    ...styles.appRoot,
    padding: isMobile ? "12px" : "24px",
  };

  const shellStyle = {
    ...styles.shell,
    padding: isMobile ? 16 : 24,
    borderRadius: isMobile ? 16 : 24,
  };

  return (
    <div className="app-root" style={appRootStyle}>
      <div style={shellStyle}>
        {/* Header */}
        <header style={styles.header}>
          <div>
            <h1 style={{ ...styles.title, fontSize: isMobile ? 20 : 24 }}>
              📄 Panel tài liệu, đề thi & blog
            </h1>
            <p
              style={{
                ...styles.subtitle,
                fontSize: isMobile ? 12 : 14,
              }}
            >
              Tài liệu: HTML, PDF, link, bộ ảnh. Đề thi: Kỳ → Môn → Đề (có đáp
              án + đề dạng ảnh). Blog: tags + tìm kiếm, trang chi tiết.
            </p>
          </div>

          <div style={styles.tabContainer}>
            <button
              style={{
                ...styles.tabButton,
                ...(tab === "admin" ? styles.tabButtonActive : {}),
                fontSize: isMobile ? 12 : 14,
              }}
              onClick={() => setTab("admin")}
            >
              Admin
            </button>
            <button
              style={{
                ...styles.tabButton,
                ...(tab === "viewer" ? styles.tabButtonActive : {}),
                fontSize: isMobile ? 12 : 14,
              }}
              onClick={() => setTab("viewer")}
            >
              Xem
            </button>
          </div>
        </header>

        {/* ADMIN TAB */}
        {tab === "admin" && (
          <div style={{ ...styles.card, padding: isMobile ? 14 : 20 }}>
            {!isAdminAuthed ? (
              <>
                <h2 style={styles.sectionTitle}>🔐 Đăng nhập Admin</h2>
                <form
                  onSubmit={handleAdminLogin}
                  style={{ ...styles.form, maxWidth: 360 }}
                >
                  <label style={styles.formLabel}>
                    Mật khẩu admin
                    <input
                      type="password"
                      value={adminPwInput}
                      onChange={(e) => setAdminPwInput(e.target.value)}
                      placeholder="Nhập mật khẩu admin..."
                      style={styles.input}
                    />
                  </label>
                  {adminError && (
                    <p style={styles.errorText}>{adminError}</p>
                  )}
                  <button
                    type="submit"
                    style={{
                      ...styles.primaryButton,
                      width: isMobile ? "100%" : "auto",
                    }}
                    disabled={!adminPwInput}
                  >
                    Đăng nhập
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 style={styles.sectionTitle}>👨‍💻 Quản lý tài liệu</h2>

                <div
                  style={{
                    ...styles.adminGrid,
                    gridTemplateColumns: isMobile
                      ? "1fr"
                      : "repeat(auto-fit, minmax(260px, 1fr))",
                  }}
                >
                  {/* HTML */}
                  <div style={styles.adminBlock}>
                    <h3 style={styles.sectionSubtitle}>📄 Tài liệu HTML</h3>
                    <div style={{ marginBottom: 16 }}>
                      <label style={styles.uploadLabel}>
                        <span>Chọn file HTML</span>
                        <input
                          type="file"
                          accept=".html,.htm"
                          onChange={handleHtmlFileChange}
                          style={{ display: "none" }}
                        />
                      </label>
                      {pendingFile && (
                        <p style={styles.infoText}>
                          Đã chọn: <strong>{pendingFile.name}</strong>
                        </p>
                      )}
                    </div>

                    <form onSubmit={handleSaveHtml} style={styles.form}>
                      <label style={styles.formLabel}>
                        Mật khẩu
                        <input
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Nhập mật khẩu..."
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.formLabel}>
                        Ghi chú (text hoặc URL)
                        <input
                          type="text"
                          value={noteHtml}
                          onChange={(e) => setNoteHtml(e.target.value)}
                          placeholder="Mô tả, link thêm..."
                          style={styles.input}
                        />
                      </label>

                      <button
                        type="submit"
                        style={{
                          ...styles.primaryButton,
                          opacity: pendingFile && passwordInput ? 1 : 0.6,
                          width: isMobile ? "100%" : "auto",
                        }}
                        disabled={!pendingFile || !passwordInput}
                      >
                        Lưu HTML
                      </button>
                    </form>
                  </div>

                  {/* PDF */}
                  <div style={styles.adminBlock}>
                    <h3 style={styles.sectionSubtitle}>📕 Tài liệu PDF</h3>
                    <div style={{ marginBottom: 16 }}>
                      <label style={styles.uploadLabel}>
                        <span>Chọn file PDF</span>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handlePdfFileChange}
                          style={{ display: "none" }}
                        />
                      </label>
                      {pdfFile && (
                        <p style={styles.infoText}>
                          Đã chọn: <strong>{pdfFile.name}</strong>
                        </p>
                      )}
                    </div>

                    <form onSubmit={handleSavePdf} style={styles.form}>
                      <label style={styles.formLabel}>
                        Mật khẩu
                        <input
                          type="password"
                          value={pdfPasswordInput}
                          onChange={(e) =>
                            setPdfPasswordInput(e.target.value)
                          }
                          placeholder="Nhập mật khẩu..."
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.formLabel}>
                        Ghi chú (text hoặc URL)
                        <input
                          type="text"
                          value={notePdf}
                          onChange={(e) => setNotePdf(e.target.value)}
                          placeholder="Ví dụ: link backup, mô tả..."
                          style={styles.input}
                        />
                      </label>

                      <button
                        type="submit"
                        style={{
                          ...styles.primaryButton,
                          opacity: pdfFile && pdfPasswordInput ? 1 : 0.6,
                          width: isMobile ? "100%" : "auto",
                        }}
                        disabled={!pdfFile || !pdfPasswordInput}
                      >
                        Upload & Lưu PDF
                      </button>
                    </form>
                  </div>

                  {/* URL */}
                  <div style={styles.adminBlock}>
                    <h3 style={styles.sectionSubtitle}>🔗 Tài liệu URL</h3>
                    <form onSubmit={handleSaveLinkDoc} style={styles.form}>
                      <label style={styles.formLabel}>
                        Tên tài liệu
                        <input
                          type="text"
                          value={linkName}
                          onChange={(e) => setLinkName(e.target.value)}
                          placeholder="Ví dụ: Docs hướng dẫn..."
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.formLabel}>
                        Link URL
                        <input
                          type="url"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://..."
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.formLabel}>
                        Mật khẩu
                        <input
                          type="password"
                          value={linkPassword}
                          onChange={(e) => setLinkPassword(e.target.value)}
                          placeholder="Nhập mật khẩu..."
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.formLabel}>
                        Ghi chú (text hoặc URL)
                        <input
                          type="text"
                          value={noteUrl}
                          onChange={(e) => setNoteUrl(e.target.value)}
                          placeholder="Ghi chú, link phụ..."
                          style={styles.input}
                        />
                      </label>

                      <button
                        type="submit"
                        style={{
                          ...styles.primaryButton,
                          opacity:
                            linkName && linkUrl && linkPassword ? 1 : 0.6,
                          width: isMobile ? "100%" : "auto",
                        }}
                        disabled={!linkName || !linkUrl || !linkPassword}
                      >
                        Lưu URL
                      </button>
                    </form>
                  </div>

                  {/* IMAGE DOC */}
                  <div style={styles.adminBlock}>
                    <h3 style={styles.sectionSubtitle}>🖼 Tài liệu dạng ảnh</h3>
                    <div style={{ marginBottom: 16 }}>
                      <label style={styles.uploadLabel}>
                        <span>Chọn nhiều ảnh (theo thứ tự trang)</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImagesFilesChange}
                          style={{ display: "none" }}
                        />
                      </label>
                      {imagesFiles.length > 0 && (
                        <p style={styles.infoText}>
                          Đã chọn:{" "}
                          <strong>{imagesFiles.length} ảnh</strong>
                        </p>
                      )}
                    </div>

                    <form onSubmit={handleSaveImagesDoc} style={styles.form}>
                      <label style={styles.formLabel}>
                        Tên tài liệu (tuỳ chọn)
                        <input
                          type="text"
                          value={imagesName}
                          onChange={(e) => setImagesName(e.target.value)}
                          placeholder="Ví dụ: Giáo trình (ảnh)"
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.formLabel}>
                        Mật khẩu
                        <input
                          type="password"
                          value={imagesPasswordInput}
                          onChange={(e) =>
                            setImagesPasswordInput(e.target.value)
                          }
                          placeholder="Nhập mật khẩu..."
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.formLabel}>
                        Ghi chú (text hoặc URL)
                        <input
                          type="text"
                          value={noteImages}
                          onChange={(e) => setNoteImages(e.target.value)}
                          placeholder="Ghi chú cho bộ ảnh..."
                          style={styles.input}
                        />
                      </label>

                      <button
                        type="submit"
                        style={{
                          ...styles.primaryButton,
                          opacity:
                            imagesFiles.length && imagesPasswordInput
                              ? 1
                              : 0.6,
                          width: isMobile ? "100%" : "auto",
                        }}
                        disabled={!imagesFiles.length || !imagesPasswordInput}
                      >
                        Upload & Lưu bộ ảnh
                      </button>
                    </form>
                  </div>
                </div>

                {/* Danh sách tài liệu */}
                <div style={{ marginTop: 24 }}>
                  <h3 style={styles.sectionSubtitle}>Danh sách tài liệu</h3>
                  {docs.length === 0 ? (
                    <p style={styles.infoText}>Chưa có tài liệu nào.</p>
                  ) : (
                    <ul style={styles.list}>
                      {docs.map((d) => (
                        <li key={d.id} style={styles.listItem}>
                          <span>
                            {d.name}{" "}
                            <small style={{ opacity: 0.7 }}>
                              (
                              {d.type === "url"
                                ? "URL"
                                : d.type === "pdf"
                                ? "PDF"
                                : d.type === "images"
                                ? "Ảnh"
                                : "HTML"}
                              )
                            </small>
                          </span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <span style={styles.badge}>Đã đặt mật khẩu</span>
                            <button
                              type="button"
                              style={styles.editButton}
                              onClick={() => startEditDoc(d)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              style={styles.dangerButton}
                              onClick={() => handleDeleteDoc(d.id)}
                            >
                              Xóa
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {editingDocId && (
                    <div style={styles.editCard}>
                      <h4 style={{ margin: "0 0 8px" }}>
                        ✏️ Chỉnh sửa tài liệu
                      </h4>
                      <form
                        onSubmit={handleUpdateDoc}
                        style={{ ...styles.form, marginTop: 4 }}
                      >
                        <label style={styles.formLabel}>
                          Tên tài liệu
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={styles.input}
                          />
                        </label>
                        <label style={styles.formLabel}>
                          Mật khẩu
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) =>
                              setEditPassword(e.target.value)
                            }
                            style={styles.input}
                          />
                        </label>
                        <label style={styles.formLabel}>
                          Ghi chú (text hoặc URL, để trống = xóa note)
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            style={styles.input}
                          />
                        </label>
                        {(() => {
                          const docItem = docs.find(
                            (d) => d.id === editingDocId
                          );
                          if (!docItem || docItem.type !== "url") return null;
                          return (
                            <label style={styles.formLabel}>
                              Link URL
                              <input
                                type="url"
                                value={editUrl}
                                onChange={(e) =>
                                  setEditUrl(e.target.value)
                                }
                                style={styles.input}
                              />
                            </label>
                          );
                        })()}

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 4,
                          }}
                        >
                          <button type="submit" style={styles.primaryButton}>
                            Lưu thay đổi
                          </button>
                          <button
                            type="button"
                            style={styles.secondaryButton}
                            onClick={cancelEditDoc}
                          >
                            Hủy
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                {/* =========== ADMIN ĐỀ THI =========== */}
                <div style={{ marginTop: 32 }}>
                  <h2 style={styles.sectionTitle}>📝 Quản lý đề thi</h2>

                  <div
                    style={{
                      display: "grid",
                      gap: 16,
                      gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr",
                    }}
                  >
                    {/* Form thêm / sửa đề thi */}
                    <div style={styles.adminBlock}>
                      <h3 style={styles.sectionSubtitle}>
                        ➕ Thêm đề thi mới
                      </h3>
                      <form onSubmit={handleSaveExam} style={styles.form}>
                        <label style={styles.formLabel}>
                          Kỳ
                          <input
                            type="text"
                            value={semesterInput}
                            onChange={(e) =>
                              setSemesterInput(e.target.value)
                            }
                            placeholder="Ví dụ: Kỳ 1, Kỳ 2..."
                            style={styles.input}
                          />
                        </label>
                        <label style={styles.formLabel}>
                          Môn học
                          <input
                            type="text"
                            value={subjectInput}
                            onChange={(e) =>
                              setSubjectInput(e.target.value)
                            }
                            placeholder="Ví dụ: PRF192, PRO192..."
                            style={styles.input}
                          />
                        </label>
                        <label style={styles.formLabel}>
                          Tên đề thi
                          <input
                            type="text"
                            value={examNameInput}
                            onChange={(e) =>
                              setExamNameInput(e.target.value)
                            }
                            placeholder="Ví dụ: Đề số 1, Thi thử lần 2..."
                            style={styles.input}
                          />
                        </label>
                        <label style={styles.formLabel}>
                          Ảnh đề thi (tùy chọn)
                          <label style={styles.uploadLabel}>
                            <span>Chọn nhiều ảnh đề thi</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleExamImagesChange}
                              style={{ display: "none" }}
                            />
                          </label>
                          {examImagesFiles.length > 0 && (
                            <span style={styles.infoText}>
                              Đã chọn {examImagesFiles.length} ảnh
                            </span>
                          )}
                        </label>
                        <label style={styles.formLabel}>
                          Đáp án (text)
                          <textarea
                            value={answersInput}
                            onChange={(e) =>
                              setAnswersInput(e.target.value)
                            }
                            placeholder="Ví dụ: 1.A 2.B 3.C ..."
                            style={{ ...styles.input, minHeight: 80 }}
                          />
                        </label>

                        <button
                          type="submit"
                          style={{
                            ...styles.primaryButton,
                            opacity:
                              semesterInput &&
                              subjectInput &&
                              examNameInput
                                ? 1
                                : 0.6,
                            width: isMobile ? "100%" : "auto",
                          }}
                          disabled={
                            !semesterInput || !subjectInput || !examNameInput
                          }
                        >
                          Lưu đề thi
                        </button>
                      </form>

                      {editingExamId && (
                        <div style={{ marginTop: 16 }}>
                          <h4 style={styles.sectionSubtitle}>
                            ✏️ Sửa đề thi
                          </h4>
                          <form
                            onSubmit={handleUpdateExam}
                            style={styles.form}
                          >
                            <label style={styles.formLabel}>
                              Kỳ
                              <input
                                type="text"
                                value={editSemester}
                                onChange={(e) =>
                                  setEditSemester(e.target.value)
                                }
                                style={styles.input}
                              />
                            </label>
                            <label style={styles.formLabel}>
                              Môn học
                              <input
                                type="text"
                                value={editSubject}
                                onChange={(e) =>
                                  setEditSubject(e.target.value)
                                }
                                style={styles.input}
                              />
                            </label>
                            <label style={styles.formLabel}>
                              Tên đề thi
                              <input
                                type="text"
                                value={editExamName}
                                onChange={(e) =>
                                  setEditExamName(e.target.value)
                                }
                                style={styles.input}
                              />
                            </label>
                            <label style={styles.formLabel}>
                              Đáp án (text)
                              <textarea
                                value={editAnswers}
                                onChange={(e) =>
                                  setEditAnswers(e.target.value)
                                }
                                style={{ ...styles.input, minHeight: 80 }}
                              />
                            </label>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="submit"
                                style={styles.primaryButton}
                              >
                                Lưu đề thi
                              </button>
                              <button
                                type="button"
                                style={styles.secondaryButton}
                                onClick={cancelEditExam}
                              >
                                Hủy
                              </button>
                            </div>
                          </form>
                          <p style={styles.infoText}>
                            (Hiện tại không sửa ảnh đề thi. Nếu cần, xóa đề và
                            tạo lại với ảnh mới.)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* List đề thi */}
                    <div style={styles.adminBlock}>
                      <h3 style={styles.sectionSubtitle}>Danh sách đề thi</h3>
                      {exams.length === 0 ? (
                        <p style={styles.infoText}>Chưa có đề thi nào.</p>
                      ) : (
                        <ul style={styles.list}>
                          {exams.map((ex) => (
                            <li key={ex.id} style={styles.listItem}>
                              <div>
                                <div>
                                  <strong>{ex.examName}</strong>
                                </div>
                                <small style={{ opacity: 0.8 }}>
                                  {ex.semester} • {ex.subject}
                                </small>
                                {ex.imageUrls && ex.imageUrls.length > 0 && (
                                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                                    Có {ex.imageUrls.length} ảnh đề thi
                                  </div>
                                )}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  type="button"
                                  style={styles.editButton}
                                  onClick={() => startEditExam(ex)}
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  style={styles.dangerButton}
                                  onClick={() => handleDeleteExam(ex.id)}
                                >
                                  Xóa
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* =========== ADMIN BLOG =========== */}
                <div style={{ marginTop: 32 }}>
                  <h2 style={styles.sectionTitle}>📰 Quản lý blog</h2>

                  <div
                    style={{
                      display: "grid",
                      gap: 16,
                      gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr",
                    }}
                  >
                    {/* Form thêm blog */}
                    <div style={styles.adminBlock}>
                      <h3 style={styles.sectionSubtitle}>➕ Viết blog mới</h3>
                      <form onSubmit={handleSaveBlog} style={styles.form}>
                        <label style={styles.formLabel}>
                          Tiêu đề
                          <input
                            type="text"
                            value={blogTitle}
                            onChange={(e) => setBlogTitle(e.target.value)}
                            placeholder="Ví dụ: Kinh nghiệm thi PRF192..."
                            style={styles.input}
                          />
                        </label>
                        <label style={styles.formLabel}>
                          Nội dung
                          <div style={styles.blogToolbar}>
                            <button
                              type="button"
                              style={styles.blogToolbarButton}
                              onClick={() => applyBlogFormat("bold")}
                            >
                              <strong>B</strong>
                            </button>
                            <button
                              type="button"
                              style={styles.blogToolbarButton}
                              onClick={() => applyBlogFormat("italic")}
                            >
                              <em>I</em>
                            </button>
                            <button
                              type="button"
                              style={styles.blogToolbarButton}
                              onClick={() => applyBlogFormat("code")}
                            >
                              {"</>"}
                            </button>
                            <button
                              type="button"
                              style={styles.blogToolbarButton}
                              onClick={() => applyBlogFormat("h2")}
                            >
                              H2
                            </button>
                            <button
                              type="button"
                              style={styles.blogToolbarButton}
                              onClick={() => applyBlogFormat("ul")}
                            >
                              • List
                            </button>
                            <button
                              type="button"
                              style={styles.blogToolbarButton}
                              onClick={() => applyBlogFormat("codeblock")}
                            >
                              {"<Code>"}
                            </button>
                            <button
                              type="button"
                              style={styles.blogToolbarButton}
                              onClick={handleInsertImage}
                              disabled={isBlogImageUploading}
                            >
                              {isBlogImageUploading ? "Đang tải..." : "📷 Ảnh"}
                            </button>
                          </div>
                          <textarea
                            ref={blogContentRef}
                            value={blogContent}
                            onChange={(e) => setBlogContent(e.target.value)}
                            placeholder="Viết nội dung blog ở đây (hỗ trợ markdown)..."
                            style={{
                              ...styles.input,
                              minHeight: 140,
                              fontFamily: "inherit",
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              opacity: 0.6,
                              marginTop: 2,
                            }}
                          >
                            Hỗ trợ markdown: **đậm**, *nghiêng*, `code`,
                            ```codeblock```, ## tiêu đề, - danh sách,
                            ![](url ảnh)...
                          </span>
                        </label>
                        <label style={styles.formLabel}>
                          Tags (phân tách bằng dấu phẩy)
                          <input
                            type="text"
                            value={blogTagsInput}
                            onChange={(e) =>
                              setBlogTagsInput(e.target.value)
                            }
                            placeholder="Ví dụ: PRF192, kinh nghiệm, note"
                            style={styles.input}
                          />
                        </label>
                        <button
                          type="submit"
                          style={{
                            ...styles.primaryButton,
                            opacity: blogTitle && blogContent ? 1 : 0.6,
                            width: isMobile ? "100%" : "auto",
                          }}
                          disabled={!blogTitle || !blogContent}
                        >
                          Lưu blog
                        </button>
                      </form>
                    </div>

                    {/* Danh sách blog */}
                    <div style={styles.adminBlock}>
                      <h3 style={styles.sectionSubtitle}>Danh sách blog</h3>
                      {blogs.length === 0 ? (
                        <p style={styles.infoText}>Chưa có blog nào.</p>
                      ) : (
                        <>
                          <ul style={styles.list}>
                            {blogs.map((b) => (
                              <li key={b.id} style={styles.blogItem}>
                                <div>
                                  <div style={styles.blogTitleText}>
                                    {b.title}
                                  </div>
                                  {b.tags && b.tags.length > 0 && (
                                    <div style={styles.blogMeta}>
                                      Tags: {b.tags.join(", ")}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    type="button"
                                    style={styles.editButton}
                                    onClick={() => startEditBlog(b)}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    style={styles.dangerButton}
                                    onClick={() => handleDeleteBlog(b.id)}
                                  >
                                    Xóa
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>

                          {editingBlogId && (
                            <div style={styles.editCard}>
                              <h4 style={{ margin: "0 0 8px" }}>
                                ✏️ Chỉnh sửa blog
                              </h4>
                              <form
                                onSubmit={handleUpdateBlog}
                                style={{ ...styles.form, marginTop: 4 }}
                              >
                                <label style={styles.formLabel}>
                                  Tiêu đề
                                  <input
                                    type="text"
                                    value={editBlogTitle}
                                    onChange={(e) =>
                                      setEditBlogTitle(e.target.value)
                                    }
                                    style={styles.input}
                                  />
                                </label>
                                <label style={styles.formLabel}>
                                  Nội dung
                                  <textarea
                                    value={editBlogContent}
                                    onChange={(e) =>
                                      setEditBlogContent(e.target.value)
                                    }
                                    style={{ ...styles.input, minHeight: 140 }}
                                  />
                                </label>
                                <label style={styles.formLabel}>
                                  Tags (phân tách bằng dấu phẩy)
                                  <input
                                    type="text"
                                    value={editBlogTagsInput}
                                    onChange={(e) =>
                                      setEditBlogTagsInput(e.target.value)
                                    }
                                    style={styles.input}
                                  />
                                </label>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                    marginTop: 4,
                                  }}
                                >
                                  <button
                                    type="submit"
                                    style={styles.primaryButton}
                                  >
                                    Lưu thay đổi
                                  </button>
                                  <button
                                    type="button"
                                    style={styles.secondaryButton}
                                    onClick={cancelEditBlog}
                                  >
                                    Hủy
                                  </button>
                                </div>
                              </form>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* VIEWER TAB */}
        {tab === "viewer" && (
          <>
            {/* Viewer tài liệu */}
            <div
              style={{
                ...styles.viewerLayout,
                ...(fullView ? styles.viewerLayoutFull : {}),
                display: "grid",
                gridTemplateColumns:
                  isMobile || fullView ? "1fr" : "220px minmax(0, 1fr)",
              }}
            >
              {/* Sidebar */}
              {(!isMobile || mobileShowSidebar) && !fullView && (
                <aside
                  style={{
                    ...styles.sidebar,
                    maxHeight: isMobile ? "none" : "600px",
                  }}
                >
                  <h2 style={styles.sectionTitle}>📚 Tài liệu</h2>
                  {docs.length === 0 ? (
                    <p style={styles.infoText}>
                      Chưa có tài liệu nào. Vào tab Admin để thêm.
                    </p>
                  ) : (
                    <ul style={styles.list}>
                      {docs.map((d) => (
                        <li
                          key={d.id}
                          style={{
                            ...styles.listItemClickable,
                            ...(d.id === selectedDocId
                              ? styles.listItemActive
                              : {}),
                          }}
                          onClick={() => {
                            setSelectedDocId(d.id);
                            setViewPassword("");
                            setViewError("");
                            setUnlockedDoc(null);
                            if (isMobile) setMobileShowSidebar(false);
                          }}
                        >
                          <div>
                            {d.name}
                            <small
                              style={{ opacity: 0.7, marginLeft: 4 }}
                            >
                              (
                              {d.type === "url"
                                ? "URL"
                                : d.type === "pdf"
                                ? "PDF"
                                : d.type === "images"
                                ? "Ảnh"
                                : "HTML"}
                              )
                            </small>
                          </div>
                          {d.note && (
                            <small style={{ opacity: 0.7 }}>
                              Note:{" "}
                              {d.note.length > 30
                                ? d.note.slice(0, 30) + "..."
                                : d.note}
                            </small>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              )}

              {/* Main viewer */}
              <main
                style={{
                  ...styles.viewerMain,
                  ...(fullView ? styles.viewerMainFull : {}),
                  padding:
                    isMobile && !fullView
                      ? 12
                      : styles.viewerMain.padding,
                }}
              >
                {isMobile && !fullView && (
                  <button
                    type="button"
                    style={{
                      ...styles.secondaryButton,
                      width: "100%",
                      marginBottom: 8,
                    }}
                    onClick={() =>
                      setMobileShowSidebar((v) => !v)
                    }
                  >
                    {mobileShowSidebar
                      ? "Ẩn danh sách tài liệu"
                      : "Hiện danh sách tài liệu"}
                  </button>
                )}

                {!currentSelectedDoc ? (
                  <p style={styles.infoText}>
                    Chọn một tài liệu trong danh sách để xem.
                  </p>
                ) : (
                  <>
                    <div style={styles.viewerHeaderRow}>
                      <h2
                        style={{
                          ...styles.sectionTitle,
                          fontSize: isMobile ? 16 : 18,
                        }}
                      >
                        {currentSelectedDoc.type === "url"
                          ? "🔗"
                          : currentSelectedDoc.type === "pdf"
                          ? "📕"
                          : currentSelectedDoc.type === "images"
                          ? "🖼"
                          : "🔐"}{" "}
                        {currentSelectedDoc.name}
                      </h2>
                      <div style={{ display: "flex", gap: 8 }}>
                        {unlockedDoc && (
                          <>
                            <button
                              type="button"
                              style={styles.secondaryButton}
                              onClick={openInNewTab}
                            >
                              Mở tab mới
                            </button>
                            <button
                              type="button"
                              style={styles.secondaryButton}
                              onClick={() => setFullView((v) => !v)}
                            >
                              {fullView ? "Thoát full view" : "Full view"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Ghi chú */}
                    {currentSelectedDoc.note && (
                      <div style={{ marginTop: 4, marginBottom: 8 }}>
                        <span style={styles.infoText}>
                          📝 Ghi chú:{" "}
                          {isProbablyUrl(currentSelectedDoc.note) ? (
                            <a
                              href={currentSelectedDoc.note}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {currentSelectedDoc.note}
                            </a>
                          ) : (
                            currentSelectedDoc.note
                          )}
                        </span>
                      </div>
                    )}

                    {!unlockedDoc && (
                      <form
                        onSubmit={handleCheckPassword}
                        style={{ ...styles.form, maxWidth: 360 }}
                      >
                        <label style={styles.formLabel}>
                          Nhập mật khẩu để xem tài liệu
                          <input
                            type="password"
                            value={viewPassword}
                            onChange={(e) =>
                              setViewPassword(e.target.value)
                            }
                            style={styles.input}
                            placeholder="Mật khẩu..."
                          />
                        </label>
                        {viewError && (
                          <p style={styles.errorText}>{viewError}</p>
                        )}
                        <button
                          type="submit"
                          style={{
                            ...styles.primaryButton,
                            width: isMobile ? "100%" : "auto",
                          }}
                          disabled={!viewPassword}
                        >
                          Xác nhận
                        </button>
                      </form>
                    )}

                    {unlockedDoc && (
                      <div style={styles.previewWrapper}>
                        <p style={styles.infoText}>
                          ✅ Đã mở khóa. Nội dung bên dưới:
                        </p>

                        {/* Zoom + nút trái/phải cho tài liệu ảnh */}
                        {unlockedDoc.type === "images" && (
                          <div style={styles.zoomControls}>
                            <span
                              style={{ fontSize: 12, opacity: 0.7 }}
                            >
                              Zoom: {Math.round(viewerZoom * 100)}%
                            </span>
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              {/* Zoom - + Reset */}
                              <button
                                type="button"
                                style={styles.smallButton}
                                onClick={() =>
                                  setViewerZoom((z) =>
                                    Math.max(0.5, z - 0.25)
                                  )
                                }
                              >
                                -
                              </button>
                              <button
                                type="button"
                                style={styles.smallButton}
                                onClick={() =>
                                  setViewerZoom((z) =>
                                    Math.min(3, z + 0.25)
                                  )
                                }
                              >
                                +
                              </button>
                              <button
                                type="button"
                                style={styles.smallButton}
                                onClick={() => setViewerZoom(1)}
                              >
                                Reset
                              </button>

                              {/* Qua trái / qua phải */}
                              <button
                                type="button"
                                style={styles.smallButton}
                                onClick={() => scrollImages("left")}
                              >
                                ◀
                              </button>
                              <button
                                type="button"
                                style={styles.smallButton}
                                onClick={() => scrollImages("right")}
                              >
                                ▶
                              </button>
                            </div>
                          </div>
                        )}

                        {unlockedDoc.type === "html" &&
                          unlockedDoc.content && (
                            <iframe
                              title={unlockedDoc.name}
                              style={{
                                ...styles.iframe,
                                ...(fullView ? styles.iframeFull : {}),
                                minHeight:
                                  isMobile && !fullView ? 400 : 600,
                              }}
                              sandbox=""
                              srcDoc={unlockedDoc.content}
                            />
                          )}

                        {unlockedDoc.type === "url" &&
                          unlockedDoc.url && (
                            <iframe
                              title={unlockedDoc.name}
                              style={{
                                ...styles.iframe,
                                ...(fullView ? styles.iframeFull : {}),
                                minHeight:
                                  isMobile && !fullView ? 400 : 600,
                              }}
                              src={unlockedDoc.url}
                            />
                          )}

                        {unlockedDoc.type === "pdf" &&
                          unlockedDoc.pdfUrl && (
                            <iframe
                              title={unlockedDoc.name}
                              style={{
                                ...styles.iframe,
                                ...(fullView ? styles.iframeFull : {}),
                                minHeight:
                                  isMobile && !fullView ? 400 : 600,
                              }}
                              src={unlockedDoc.pdfUrl}
                            />
                          )}

                        {unlockedDoc.type === "images" &&
                          unlockedDoc.imageUrls &&
                          unlockedDoc.imageUrls.length > 0 && (
                            <div
                              ref={imagesWrapperRef}
                              style={{
                                ...styles.imagesWrapper,
                                ...(isMobile
                                  ? {
                                      overflowX: "hidden", // mobile: không kéo ngang bằng tay
                                      touchAction: "pan-y", // chỉ pan dọc
                                    }
                                  : {}),
                              }}
                            >
                              <div
                                style={{
                                  transform: isMobile
                                    ? `translateX(${imageOffsetX}px)`
                                    : "none",
                                  transition: "transform 0.25s ease-out",
                                }}
                              >
                                {unlockedDoc.imageUrls.map(
                                  (src, idx) => (
                                    <img
                                      key={idx}
                                      src={src}
                                      alt={`${unlockedDoc.name} - trang ${
                                        idx + 1
                                      }`}
                                      style={{
                                        ...styles.imagePage,
                                        width: `${viewerZoom * 100}%`,
                                      }}
                                    />
                                  )
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </>
                )}
              </main>
            </div>

            {/* Viewer đề thi */}
            <div
              style={{
                ...styles.card,
                marginTop: 16,
                padding: isMobile ? 12 : 16,
              }}
            >
              <h2 style={styles.sectionTitle}>📝 Đề thi theo Kỳ / Môn</h2>
              {exams.length === 0 ? (
                <p style={styles.infoText}>Chưa có đề thi nào.</p>
              ) : (
                <div style={styles.examWrapper}>
                  {Object.keys(groupedExams)
                    .sort()
                    .map((semKey) => (
                      <div key={semKey} style={{ marginBottom: 16 }}>
                        <h3 style={styles.examSemesterTitle}>
                          {semKey}
                        </h3>
                        {Object.keys(groupedExams[semKey])
                          .sort()
                          .map((subKey) => (
                            <div key={subKey} style={{ marginBottom: 8 }}>
                              <h4 style={styles.examSubjectTitle}>
                                {subKey}
                              </h4>
                              <ul style={styles.examList}>
                                {groupedExams[semKey][subKey].map(
                                  (ex) => (
                                    <li
                                      key={ex.id}
                                      style={styles.examItemRow}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent:
                                            "space-between",
                                          gap: 8,
                                          alignItems: "center",
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        <span>{ex.examName}</span>
                                        <button
                                          type="button"
                                          style={
                                            styles.secondaryButton
                                          }
                                          onClick={() =>
                                            setOpenExamId((prev) =>
                                              prev === ex.id
                                                ? null
                                                : ex.id
                                            )
                                          }
                                        >
                                          {openExamId === ex.id
                                            ? "Ẩn đề / đáp án"
                                            : "Xem đề / đáp án"}
                                        </button>
                                      </div>
                                      {openExamId === ex.id && (
                                        <div style={{ marginTop: 6 }}>
                                          {ex.answers && (
                                            <div
                                              style={
                                                styles.examAnswersBox
                                              }
                                            >
                                              <pre
                                                style={{
                                                  margin: 0,
                                                  whiteSpace:
                                                    "pre-wrap",
                                                  fontSize: 13,
                                                }}
                                              >
                                                {ex.answers}
                                              </pre>
                                            </div>
                                          )}

                                          {ex.imageUrls &&
                                            ex.imageUrls.length > 0 && (
                                              <div
                                                style={
                                                  styles.examImagesWrapper
                                                }
                                              >
                                                {ex.imageUrls.map(
                                                  (
                                                    src,
                                                    idx
                                                  ) => (
                                                    <img
                                                      key={idx}
                                                      src={src}
                                                      alt={`${ex.examName} - trang ${
                                                        idx + 1
                                                      }`}
                                                      style={
                                                        styles.examImage
                                                      }
                                                    />
                                                  )
                                                )}
                                              </div>
                                            )}
                                        </div>
                                      )}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          ))}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Viewer blog */}
            <div
              style={{
                ...styles.card,
                marginTop: 16,
                padding: isMobile ? 12 : 16,
              }}
            >
              <h2 style={styles.sectionTitle}>📰 Blog</h2>
              {blogs.length === 0 ? (
                <p style={styles.infoText}>Chưa có blog nào.</p>
              ) : activeBlog ? (
                // Trang chi tiết blog
                <div style={styles.blogDetailCard}>
                  <button
                    type="button"
                    style={{
                      ...styles.secondaryButton,
                      marginBottom: 8,
                    }}
                    onClick={() => setActiveBlogId(null)}
                  >
                    ← Quay lại danh sách
                  </button>
                  <h3 style={{ margin: "4px 0 8px" }}>
                    {activeBlog.title}
                  </h3>
                  <div style={styles.blogMeta}>
                    {activeBlog.tags && activeBlog.tags.length > 0 && (
                      <span>Tags: {activeBlog.tags.join(", ")} • </span>
                    )}
                    {activeBlog.createdAt && (
                      <span>
                        {new Date(
                          activeBlog.createdAt
                        ).toLocaleString("vi-VN")}
                      </span>
                    )}
                  </div>
                  <div style={styles.blogDetailContent}>
                    {activeBlog.content}
                  </div>
                </div>
              ) : (
                // Danh sách blog + filter
                <>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      gap: 8,
                      alignItems: isMobile ? "stretch" : "center",
                      marginBottom: 8,
                    }}
                  >
                    <input
                      type="text"
                      value={blogSearch}
                      onChange={(e) => setBlogSearch(e.target.value)}
                      placeholder="Tìm blog theo tiêu đề / nội dung..."
                      style={{
                        ...styles.input,
                        maxWidth: isMobile ? "100%" : 320,
                      }}
                    />
                    {allBlogTags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          marginTop: isMobile ? 4 : 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            opacity: 0.7,
                            marginRight: 4,
                          }}
                        >
                          Tags:
                        </span>
                        <button
                          type="button"
                          style={{
                            ...styles.blogTagChip,
                            ...(activeBlogTag === null
                              ? styles.blogTagChipActive
                              : {}),
                          }}
                          onClick={() => setActiveBlogTag(null)}
                        >
                          Tất cả
                        </button>
                        {allBlogTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            style={{
                              ...styles.blogTagChip,
                              ...(activeBlogTag === tag
                                ? styles.blogTagChipActive
                                : {}),
                            }}
                            onClick={() =>
                              setActiveBlogTag((prev) =>
                                prev === tag ? null : tag
                              )
                            }
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {filteredBlogs.length === 0 ? (
                    <p style={styles.infoText}>
                      Không tìm thấy blog phù hợp.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {filteredBlogs.map((b) => (
                        <article key={b.id} style={styles.blogListItem}>
                          <div
                            style={{ cursor: "pointer" }}
                            onClick={() => setActiveBlogId(b.id)}
                          >
                            <div style={styles.blogTitleText}>
                              {b.title}
                            </div>
                            {b.tags && b.tags.length > 0 && (
                              <div style={styles.blogMeta}>
                                Tags: {b.tags.join(", ")}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            style={styles.secondaryButton}
                            onClick={() => setActiveBlogId(b.id)}
                          >
                            Xem chi tiết
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Styles
const styles = {
  appRoot: {
    minHeight: "100vh",
    padding: "24px",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#0f172a",
    boxSizing: "border-box",
  },
  shell: {
    maxWidth: "100%",
    width: "100%",
    margin: "0 auto",
    background: "white",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 20px 40px rgba(15,23,42,0.12)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 24,
    margin: 0,
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    opacity: 0.7,
  },
  tabContainer: {
    display: "flex",
    gap: 8,
  },
  tabButton: {
    padding: "8px 16px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "white",
    cursor: "pointer",
    fontSize: 14,
  },
  tabButtonActive: {
    background: "#2563eb",
    color: "white",
    borderColor: "#2563eb",
  },
  card: {
    marginTop: 8,
    padding: 20,
    borderRadius: 20,
    background: "#f9fafb",
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  uploadLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px dashed #9ca3af",
    cursor: "pointer",
    fontSize: 14,
    background: "white",
  },
  infoText: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    color: "#dc2626",
    marginTop: 4,
  },
  form: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  formLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 14,
  },
  input: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    padding: "8px 16px",
    borderRadius: 999,
    border: "none",
    background: "#2563eb",
    color: "white",
    fontSize: 14,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "6px 14px",
    borderRadius: 999,
    border: "1px solid #2563eb",
    background: "white",
    color: "#2563eb",
    fontSize: 13,
    cursor: "pointer",
  },
  smallButton: {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #9ca3af",
    background: "white",
    fontSize: 12,
    cursor: "pointer",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  listItem: {
    padding: "8px 10px",
    borderRadius: 10,
    background: "white",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 14,
    border: "1px solid #e5e7eb",
  },
  listItemClickable: {
    padding: "8px 10px",
    borderRadius: 10,
    background: "white",
    border: "1px solid #e5e7eb",
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  listItemActive: {
    borderColor: "#2563eb",
    boxShadow: "0 0 0 1px rgba(37,99,235,0.2)",
  },
  badge: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#fee2e2",
    color: "#b91c1c",
  },
  editButton: {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #4f46e5",
    background: "white",
    color: "#4f46e5",
    fontSize: 12,
    cursor: "pointer",
  },
  dangerButton: {
    padding: "4px 10px",
    borderRadius: 999,
    border: "none",
    background: "#ef4444",
    color: "white",
    fontSize: 12,
    cursor: "pointer",
  },
  viewerLayout: {
    marginTop: 8,
    gap: 12,
  },
  viewerLayoutFull: {
    gridTemplateColumns: "1fr",
  },
  sidebar: {
    background: "#f9fafb",
    borderRadius: 16,
    padding: 12,
    maxHeight: "600px",
    overflow: "auto",
  },
  viewerMain: {
    background: "#f9fafb",
    borderRadius: 16,
    padding: 16,
    minHeight: 400,
  },
  viewerMainFull: {
    borderRadius: 0,
    padding: 0,
    minHeight: "100vh",
  },
  previewWrapper: {
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
    background: "white",
  },
  iframe: {
    width: "100%",
    minHeight: 600,
    border: "none",
  },
  iframeFull: {
    minHeight: "100vh",
  },
  viewerHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  adminGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
    marginTop: 8,
  },
  adminBlock: {
    padding: 16,
    borderRadius: 16,
    background: "white",
    border: "1px solid #e5e7eb",
  },
  editCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    background: "#eef2ff",
    border: "1px solid #6366f1",
  },
  imagesWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 8,
    maxHeight: 900,
    overflowY: "auto",
    overflowX: "auto", // desktop vẫn kéo ngang được
    background: "#0f172a",
  },
  imagePage: {
    height: "auto",
    borderRadius: 8,
    background: "#020617",
    display: "block",
    margin: "0 auto",
  },
  examWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  examSemesterTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 4,
  },
  examSubjectTitle: {
    fontSize: 14,
    fontWeight: 600,
    margin: "4px 0",
  },
  examList: {
    listStyle: "none",
    paddingLeft: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  examItemRow: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "white",
  },
  examAnswersBox: {
    marginTop: 4,
    marginBottom: 6,
    padding: 8,
    borderRadius: 8,
    background: "#0f172a",
    color: "#e5e7eb",
  },
  examImagesWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 4,
  },
  examImage: {
    maxWidth: "100%",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  },
  zoomControls: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  blogItem: {
    padding: "8px 10px",
    borderRadius: 10,
    background: "white",
    border: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  blogListItem: {
    padding: "8px 10px",
    borderRadius: 10,
    background: "white",
    border: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "flex-start",
  },
  blogTitleText: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 2,
  },
  blogMeta: {
    fontSize: 12,
    opacity: 0.7,
  },
  blogSnippet: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.9,
    whiteSpace: "pre-wrap",
  },
  blogContentText: {
    marginTop: 4,
    fontSize: 13,
    whiteSpace: "pre-wrap",
  },
  blogTagChip: {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "white",
    fontSize: 12,
    cursor: "pointer",
  },
  blogTagChipActive: {
    background: "#2563eb",
    color: "#ffffff",
    borderColor: "#2563eb",
  },
  blogToolbar: {
    display: "flex",
    gap: 6,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  blogToolbarButton: {
    padding: "4px 8px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#f9fafb",
    fontSize: 12,
    cursor: "pointer",
  },
  blogDetailCard: {
    padding: 12,
    borderRadius: 12,
    background: "white",
    border: "1px solid #e5e7eb",
  },
  blogDetailContent: {
    marginTop: 8,
    fontSize: 14,
    whiteSpace: "pre-wrap",
  },
};

export default App;
