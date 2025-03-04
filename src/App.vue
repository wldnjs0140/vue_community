<template>
  <div class="container">
    <h1>게시판</h1>
    <hr />

    <!-- 검색 영역 -->
    <div class="search-area">
      <select v-model="searchType">
        <option value="name">작성자</option>
        <option value="subject">제목</option>
        <option value="content">내용</option>
      </select>
      <input
        v-model="keyword"
        @keyup.enter="search"
        placeholder="검색어를 입력하세요"
      />
      <button @click="search">검색</button>
      <button @click="resetSearch">초기화</button>
    </div>

    <!-- 모드 전환 버튼 -->
    <div class="toggle-buttons">
      <button
        :class="{ active: isLazyLoading }"
        @click="toggleLoadingMode(true)"
      >
        레이지_로딩
      </button>
      <button
        :class="{ active: !isLazyLoading }"
        @click="toggleLoadingMode(false)"
      >
        페이징
      </button>
    </div>

    <!-- 테이블 영역 -->
    <div class="tblArea">
      <button v-if="!isDelMode" class="goDelMode" @click="goDelMode">
        삭제모드
      </button>
      <button v-if="isDelMode" class="goDelMode" @click="goDelMode">
        기본보기
      </button>
      <button class="addBtn" @click="openAddModal">게시글 추가</button>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th v-if="isDelMode">
                <button class="delBtn" @click="delBtn">삭제</button>
              </th>
              <th>번호</th>
              <th>이름</th>
              <th>제목</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(item, index) in listData" :key="item.seq">
              <tr @click="toggleContent(index, $event)">
                <td v-if="isDelMode" @click.stop style="position: relative">
                  <label>
                    <input
                      type="checkbox"
                      :value="item.seq"
                      style="width: 100%; height: 100%; font-size: 10px"
                      @change="onCheckboxChange($event, item.seq)"
                    />
                  </label>
                </td>
                <td>{{ item.seq }}</td>
                <td v-html="highlightText(item.memName)"></td>
                <!-- 작성자 이름 강조 -->
                <td v-html="highlightText(item.boardSubject)"></td>
                <!-- 제목 강조 -->
              </tr>
              <tr v-if="openIndexes.has(index)" class="content-row">
                <td :colspan="colspanValue">
                  <div class="dropdown-content">
                    <div v-if="isEditing === index">
                      <textarea v-model="editedContent" /><br />
                      <button @click="saveEdit(item.seq)" class="saveBtn">
                        저장
                      </button>
                      <button @click="cancelEdit" class="cancelBtn">
                        취소
                      </button>
                    </div>
                    <div v-else>
                      <span v-html="highlightText(item.boardContent)"></span>
                      <!-- 내용 강조 -->
                      <button
                        @click.stop="editBtn(index, item.boardContent)"
                        class="editBtn"
                      >
                        수정
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 페이징 버튼 (처음, 끝 추가 및 입력 창) -->
    <div v-if="!isLazyLoading" class="pagination">
      <button @click="firstPage" :disabled="curPage === 1">처음</button>
      <button @click="prevPage" :disabled="curPage === 1">이전</button>
      <input
        type="number"
        v-model.number="inputPage"
        @keyup.enter="goToPage"
        :max="totalPages"
        min="1"
      />
      <span>/ {{ totalPages }}</span>
      <button @click="nextPage" :disabled="!hasMore">다음</button>
      <button
        @click="lastPage"
        :disabled="curPage === totalPages || !totalPages"
      >
        끝
      </button>
    </div>

    <!-- "맨 아래로"와 "제일 위로" 버튼 (레이지 로딩 모드에서만 표시) -->
    <div v-if="isLazyLoading" class="scroll-buttons">
      <button class="scroll-to-top-btn" @click="loadTopPosts">↑</button>
      <button class="scroll-to-bottom-btn" @click="loadAllPosts">↓</button>
    </div>

    <!-- 게시글 입력 모달 -->
    <div v-if="showAddModal" class="modal">
      <div class="modal-content">
        <h2>게시글 작성</h2>
        <label
          >작성자 이름:
          <input v-model="newPost.memName" placeholder="이름 입력" /> </label
        ><br />
        <label
          >제목:
          <input
            v-model="newPost.boardSubject"
            placeholder="제목 입력"
          /> </label
        ><br />
        <label
          >내용:
          <textarea
            v-model="newPost.boardContent"
            placeholder="내용 입력"
          ></textarea></label
        ><br />
        <button @click="saveNewPost" class="saveBtn">저장</button>
        <button @click="closeAddModal" class="cancelBtn">취소</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from "vue";

const listData = ref([]);
const openIndexes = ref(new Set());
const isEditing = ref(null);
const editedContent = ref("");
const isDelMode = ref(false);
const colspanValue = ref(3);
const selectedIndexes = ref(new Set());
const curPage = ref(1);
const listSize = ref(15);
const hasMore = ref(true);
const isLazyLoading = ref(true);
const totalCount = ref(0); // 전체 게시글 수 추가
const inputPage = ref(curPage.value);
const isFetching = ref(false);

const searchType = ref("subject");
const keyword = ref("");

const showAddModal = ref(false);
const newPost = ref({
  memName: "",
  boardSubject: "",
  boardContent: "",
  memId: "defaultUser",
});

// 검색어 강조 함수
const highlightText = (text) => {
  if (!keyword.value || !text) return String(text || ""); // 빈 값 처리 및 문자열 보장
  const escapedKeyword = keyword.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // 특수문자 이스케이프
  const regex = new RegExp(`(${escapedKeyword})`, "gi");
  return String(text).replace(regex, '<span class="highlight">$1</span>');
};
// "맨 아래로" 버튼 클릭 시 모든 게시글 로드
const loadAllPosts = async () => {
  if (isFetching.value) return;

  // 이미 모든 데이터가 로드된 경우 스크롤만 이동
  if (listData.value.length >= totalCount.value) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return;
  }

  isFetching.value = true;
  try {
    const url = new URL("http://localhost:84/list");
    url.searchParams.append("curPage", 1);
    url.searchParams.append("listSize", totalCount.value);
    if (keyword.value) {
      url.searchParams.append("searchType", searchType.value);
      url.searchParams.append("keyword", keyword.value);
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error("서버 응답 오류");
    const data = await res.json();

    listData.value = data;
    curPage.value = totalPages.value + 1;
    hasMore.value = false;
    // DOM 업데이트 후 스크롤 이동 보장
    await nextTick(); // Vue의 DOM 업데이트 대기
    window.scrollTo(0, document.documentElement.scrollHeight);
  } catch (error) {
    console.error("전체 게시글 불러오기 실패:", error);
  } finally {
    isFetching.value = false;
  }
};

// "제일 위로" 버튼 클릭 시 첫 페이지로 이동
const loadTopPosts = async () => {
  if (listData.value.length < totalCount.value) {
    await loadAllPosts(); // 모든 데이터가 로드되지 않았다면 먼저 로드
  }
  window.scrollTo(0, 0);
};

// 총 페이지 수 계산
const totalPages = computed(() => {
  return Math.ceil(totalCount.value / listSize.value) || 1;
});

const toggleLoadingMode = (lazy) => {
  isLazyLoading.value = lazy;
  curPage.value = 1;
  listData.value = [];
  hasMore.value = true;
  isEditing.value = null;
  openIndexes.value.clear();
  keyword.value = "";
  fetchData();
};

const onCheckboxChange = (event, seq) => {
  if (event.target.checked) selectedIndexes.value.add(seq);
  else selectedIndexes.value.delete(seq);
};

const goDelMode = () => {
  isDelMode.value = !isDelMode.value;
  colspanValue.value = isDelMode.value ? 4 : 3;
};

const toggleContent = (index) => {
  if (openIndexes.value.has(index)) openIndexes.value.delete(index);
  else openIndexes.value.add(index);
  openIndexes.value = new Set(openIndexes.value);
};

const editBtn = (index, content) => {
  isEditing.value = index;
  editedContent.value = content;
};

const cancelEdit = () => {
  isEditing.value = null;
  editedContent.value = "";
};

const saveEdit = (seq) => {
  const updateData = { seq, boardContent: editedContent.value };
  fetch("http://localhost:84/api/bbsUpdate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData),
  })
    .then((res) => {
      if (!res.ok) throw new Error("수정 실패");
      return res.json();
    })
    .then(() => {
      listData.value = listData.value.map((item) =>
        item.seq === seq ? { ...item, boardContent: editedContent.value } : item
      );
      isEditing.value = null;
    })
    .catch((error) => console.error("수정 요청 실패:", error));
};

const delBtn = () => {
  const seq = Array.from(selectedIndexes.value);
  if (!confirm("삭제하시겠습니까?")) return;
  fetch("http://localhost:84/api/bbsDel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seq }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("삭제 실패");
      return res.json();
    })
    .then(() => {
      listData.value = listData.value.filter(
        (item) => !selectedIndexes.value.has(item.seq)
      );
      selectedIndexes.value.clear();
      fetchTotalCount(); // 삭제 후 총 개수 갱신
      fetchData();
    })
    .catch((error) => console.error("삭제 요청 실패:", error));
};

const search = () => {
  curPage.value = 1;
  listData.value = [];
  hasMore.value = true;
  fetchData();
  fetchTotalCount();
};

const resetSearch = () => {
  searchType.value = "subject";
  keyword.value = "";
  curPage.value = 1;
  listData.value = [];
  hasMore.value = true;
  fetchData();
  fetchTotalCount();
};

// 데이터 가져오기
const fetchData = async () => {
  if (isFetching.value) return;
  isFetching.value = true;
  try {
    openIndexes.value.clear();
    const url = new URL("http://localhost:84/list");
    url.searchParams.append("curPage", curPage.value);
    url.searchParams.append("listSize", listSize.value);
    if (keyword.value) {
      url.searchParams.append("searchType", searchType.value);
      url.searchParams.append("keyword", keyword.value);
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error("서버 응답 오류");
    const data = await res.json();

    if (isLazyLoading.value) {
      if (!hasMore.value && curPage.value <= totalPages.value) return;
      listData.value.push(...data);
      curPage.value++;
      if (data.length < listSize.value) hasMore.value = false;
    } else {
      listData.value = data;
      hasMore.value = curPage.value < totalPages.value; // 다음 페이지가 있으면 true
    }
  } catch (error) {
    console.error("데이터 불러오기 실패:", error);
  } finally {
    isFetching.value = false;
  }
};

// 전체 게시글 수 가져오기
const fetchTotalCount = async () => {
  try {
    const url = new URL("http://localhost:84/api/totalCount");
    if (keyword.value) {
      url.searchParams.append("searchType", searchType.value);
      url.searchParams.append("keyword", keyword.value);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error("총 개수 조회 실패");
    const data = await res.json();
    totalCount.value = data;
  } catch (error) {
    console.error("총 개수 불러오기 실패:", error);
  }
};

// 페이징 함수
const firstPage = () => {
  curPage.value = 1;
  fetchData();
};

const prevPage = () => {
  if (curPage.value > 1) {
    curPage.value--;
    fetchData();
  }
};

const nextPage = () => {
  if (curPage.value < totalPages.value) {
    curPage.value++;
    fetchData();
  }
};

const lastPage = () => {
  curPage.value = totalPages.value;
  fetchData();
};

const goToPage = () => {
  const page = parseInt(inputPage.value, 10);
  if (isNaN(page) || page < 1 || page > totalPages.value) {
    alert(`1에서 ${totalPages.value} 사이의 페이지를 입력해주세요.`);
    inputPage.value = curPage.value; // 잘못된 입력 시 현재 페이지로 복원
    return;
  }
  curPage.value = page;
  fetchData();
};

// curPage가 변경될 때 inputPage 동기화 (선택 사항)
watch(curPage, (newPage) => {
  inputPage.value = newPage;
});

const openAddModal = () => {
  showAddModal.value = true;
};

const closeAddModal = () => {
  showAddModal.value = false;
  newPost.value = {
    memName: "",
    boardSubject: "",
    boardContent: "",
    memId: "defaultUser",
  };
};

const saveNewPost = () => {
  if (
    !newPost.value.memName ||
    !newPost.value.boardSubject ||
    !newPost.value.boardContent
  ) {
    alert("모든 필드를 입력해주세요.");
    return;
  }
  fetch("http://localhost:84/api/bbsWrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newPost.value),
  })
    .then((res) => {
      if (!res.ok) throw new Error("등록 실패");
      return res.json();
    })
    .then(() => {
      closeAddModal();
      curPage.value = 1;
      listData.value = [];
      fetchData();
      fetchTotalCount(); // 추가 후 총 개수 갱신
    })
    .catch((error) => console.error("등록 실패:", error));
};

const handleScroll = () => {
  if (!isLazyLoading.value) return;
  const scrollPosition = window.innerHeight + window.scrollY;
  const documentHeight = document.documentElement.offsetHeight;
  if (scrollPosition >= documentHeight - 10) fetchData();
};

onMounted(() => {
  fetchData();
  fetchTotalCount();
  window.addEventListener("scroll", handleScroll);
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<style scoped>
/* 기존 스타일 유지 */
* {
  user-select: none;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: "Arial", sans-serif;
}
body {
  overflow-y: scroll; /* 항상 세로 스크롤바 표시 */
  min-height: 100vh; /* 최소 높이 설정 */
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  min-height: 101vh; /* 컨테이너가 뷰포트보다 커서 스크롤바 유지 */
}
/* 검색어 강조 스타일 */
.highlight {
  background-color: yellow; /* 강조 배경색 */
  font-weight: bold; /* 글자 굵게 */
  padding: 2px 4px; /* 약간의 여백 */
  border-radius: 3px; /* 둥근 모서리 */
}
/* :deep()로 v-html 내부 요소에 스타일 적용 */
:deep(.highlight) {
  background-color: yellow;
  font-weight: bold;
  padding: 2px 4px;
  border-radius: 3px;
}
h1 {
  text-align: center;
  margin-bottom: 20px;
  color: #333;
}

hr {
  border: 0;
  border-top: 1px solid #ddd;
  margin-bottom: 30px;
}

.search-area {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.search-area select,
.search-area input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.search-area input {
  width: 200px;
}

.search-area button {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.search-area button:hover {
  background-color: #0056b3;
}

.toggle-buttons {
  text-align: center;
  margin-bottom: 20px;
}

.toggle-buttons button {
  padding: 10px 20px;
  margin: 5px;
  background-color: #e9ecef;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.toggle-buttons button.active {
  background-color: #007bff;
  color: white;
}

.toggle-buttons button:hover {
  background-color: #ced4da;
}

.tblArea {
  position: relative;
  margin-bottom: 20px;
}

.goDelMode,
.addBtn {
  position: absolute;
  top: -40px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: white;
  transition: background-color 0.3s;
}

.goDelMode {
  left: 0;
  background-color: #6c757d;
}

.goDelMode:hover {
  background-color: #5a6268;
}

.addBtn {
  right: 0;
  background-color: #ff9800;
}

.addBtn:hover {
  background-color: #e68a00;
}

.table-wrapper {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  border: 1px solid #dcddde; /* 테이블 외곽선 추가 */
}

th,
td {
  padding: 12px;
  text-align: center;
  border-bottom: 1px solid #dcddde;
  border: 1px solid #dcddde; /* 각 셀마다 경계선 추가 */
}

th {
  background-color: #dcddde;
  font-weight: bold;
  color: #1a1919;
}

tr {
  transition: background-color 0.2s;
}

tr:hover:not(.content-row) {
  background-color: #e8eaeb;
}

.content-row {
  background-color: #f8f9fa;
}

.dropdown-content {
  padding: 10px;
}

textarea {
  width: 100%;
  height: 60px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
  margin-bottom: 10px;
  text-align: center;
}
.dropdown-content {
  position: relative;
}
.editBtn,
.saveBtn,
.cancelBtn,
.delBtn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  transition: background-color 0.3s;
}

.editBtn {
  position: absolute;
  right: 3%;
  top: 10%;
  background-color: #28a745;
  margin-left: 10px;
}

.editBtn:hover {
  background-color: #218838;
}

.saveBtn {
  background-color: #007bff;
  margin-right: 5px;
}

.saveBtn:hover {
  background-color: #0056b3;
}

.cancelBtn {
  background-color: #dc3545;
}

.cancelBtn:hover {
  background-color: #c82333;
}

.delBtn {
  background-color: #dc3545;
}

.delBtn:hover {
  background-color: #c82333;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
  align-items: center;
}

.pagination button {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.pagination button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.pagination button:hover:not(:disabled) {
  background-color: #0056b3;
}

.pagination input {
  width: 60px;
  padding: 8px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.pagination span {
  padding: 8px;
  color: #333;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.modal-content h2 {
  margin-bottom: 20px;
  color: #333;
}

.modal-content label {
  display: block;
  margin-bottom: 15px;
  text-align: left;
}

.modal-content input,
.modal-content textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-top: 5px;
}

.modal-content textarea {
  height: 100px;
  resize: vertical;
}
/* 스크롤 버튼 컨테이너 */
.scroll-buttons {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* "제일 위로" 버튼 스타일 */
.scroll-to-top-btn {
  width: 50px;
  height: 50px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  transition: background-color 0.3s;
}

.scroll-to-top-btn:hover {
  background-color: #0056b3;
}

/* "맨 아래로" 버튼 스타일 */
.scroll-to-bottom-btn {
  width: 50px;
  height: 50px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  transition: background-color 0.3s;
}

.scroll-to-bottom-btn:hover {
  background-color: #218838;
}

@media (max-width: 768px) {
  .container {
    padding: 10px;
  }

  h1 {
    font-size: 1.5rem;
  }

  .search-area {
    flex-direction: column;
    align-items: center;
  }

  .search-area select,
  .search-area input,
  .search-area button {
    width: 100%;
    max-width: 300px;
  }

  .toggle-buttons button {
    width: 45%;
    padding: 8px;
  }

  .goDelMode,
  .addBtn {
    position: static;
    width: 48%;
    margin: 5px 1%;
  }

  th,
  td {
    padding: 8px;
    font-size: 0.9rem;
  }

  .pagination button,
  .pagination span {
    padding: 6px 12px;
    font-size: 0.9rem;
  }

  .pagination input {
    width: 50px;
  }
  .scroll-to-top-btn,
  .scroll-to-bottom-btn {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  h1 {
    font-size: 1.2rem;
  }

  th,
  td {
    font-size: 0.8rem;
  }

  .editBtn,
  .saveBtn,
  .cancelBtn,
  .delBtn {
    padding: 4px 8px;
    font-size: 0.8rem;
  }

  .modal-content {
    width: 95%;
    padding: 15px;
  }

  .pagination button {
    padding: 4px 8px;
  }

  .pagination input {
    width: 40px;
  }
  .scroll-to-top-btn,
  .scroll-to-bottom-btn {
    width: 35px;
    height: 35px;
    font-size: 14px;
  }
}
</style>
