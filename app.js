(() => {
  "use strict";

  const QUESTIONS = window.QUESTION_BANK || [];
  const STORAGE_KEY = "genai-cv-mock-attempt-v1";
  const TOTAL = QUESTIONS.length;
  const byId = new Map(QUESTIONS.map((question) => [question.id, question]));

  const $ = (id) => document.getElementById(id);
  const landing = $("landing");
  const exam = $("exam");
  const results = $("results");
  const startButton = $("startButton");
  const resumeButton = $("resumeButton");
  const questionGrid = $("questionGrid");
  const questionText = $("questionText");
  const questionCount = $("questionCount");
  const options = $("options");
  const progressBar = $("progressBar");
  const answeredLabel = $("answeredLabel");
  const timer = $("timer");
  const previousButton = $("previousButton");
  const nextButton = $("nextButton");
  const flagButton = $("flagButton");
  const sidebarSubmit = $("sidebarSubmit");
  const submitHint = $("submitHint");
  const modal = $("modal");
  const examSidebar = $("examSidebar");
  const sidebarScrim = $("sidebarScrim");

  let attempt = null;
  let timerHandle = null;
  let reviewFilter = "all";

  function shuffle(items) {
    const copy = [...items];
    const random = new Uint32Array(copy.length);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(random);
    } else {
      for (let i = 0; i < random.length; i += 1) random[i] = Math.floor(Math.random() * 2 ** 32);
    }
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = random[i] % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function freshAttempt() {
    return {
      version: 1,
      order: shuffle(QUESTIONS.map((question) => question.id)),
      answers: {},
      flagged: [],
      current: 0,
      startedAt: Date.now(),
      elapsedAtSubmit: null,
      submitted: false,
    };
  }

  function loadAttempt() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || saved.version !== 1 || !Array.isArray(saved.order) || saved.order.length !== TOTAL) return null;
      if (!saved.order.every((id) => byId.has(id))) return null;
      return saved;
    } catch (_) {
      return null;
    }
  }

  function saveAttempt() {
    if (attempt) localStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  }

  function show(view) {
    landing.classList.toggle("hidden", view !== "landing");
    exam.classList.toggle("hidden", view !== "exam");
    results.classList.toggle("hidden", view !== "results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatTime(ms, includeHours = true) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [minutes, seconds].map((part) => String(part).padStart(2, "0"));
    return includeHours ? [hours, ...parts].map((part) => String(part).padStart(2, "0")).join(":") : parts.join(":");
  }

  function elapsedMs() {
    return attempt.elapsedAtSubmit ?? Date.now() - attempt.startedAt;
  }

  function startTimer() {
    clearInterval(timerHandle);
    const tick = () => { timer.textContent = formatTime(elapsedMs()); };
    tick();
    timerHandle = setInterval(tick, 1000);
  }

  function answeredCount() {
    return Object.keys(attempt.answers).length;
  }

  function currentQuestion() {
    return byId.get(attempt.order[attempt.current]);
  }

  function beginAttempt(forceNew = false) {
    if (forceNew || !attempt || attempt.submitted) attempt = freshAttempt();
    saveAttempt();
    show("exam");
    buildNavigator();
    renderQuestion();
    startTimer();
  }

  function buildNavigator() {
    questionGrid.innerHTML = "";
    attempt.order.forEach((id, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nav-question";
      button.textContent = String(index + 1);
      button.dataset.index = String(index);
      button.setAttribute("aria-label", `Go to question ${index + 1}`);
      button.addEventListener("click", () => {
        attempt.current = index;
        saveAttempt();
        renderQuestion();
        closeSidebar();
      });
      questionGrid.appendChild(button);
    });
  }

  function updateProgress() {
    const answered = answeredCount();
    answeredLabel.textContent = `${answered} / ${TOTAL}`;
    progressBar.style.width = `${(answered / TOTAL) * 100}%`;
    sidebarSubmit.disabled = answered !== TOTAL;
    sidebarSubmit.textContent = answered === TOTAL ? "Submit test" : `${TOTAL - answered} remaining`;
    submitHint.textContent = answered === TOTAL
      ? "All questions answered. You can submit from the navigator."
      : `Answer ${TOTAL - answered} more question${TOTAL - answered === 1 ? "" : "s"} to unlock submission.`;
    [...questionGrid.children].forEach((button, index) => {
      const id = attempt.order[index];
      button.classList.toggle("answered", Object.prototype.hasOwnProperty.call(attempt.answers, id));
      button.classList.toggle("flagged", attempt.flagged.includes(id));
      button.classList.toggle("current", index === attempt.current);
      button.setAttribute("aria-current", index === attempt.current ? "step" : "false");
    });
  }

  function renderQuestion() {
    const question = currentQuestion();
    questionCount.textContent = `Question ${attempt.current + 1} of ${TOTAL}`;
    questionText.textContent = question.question;
    options.innerHTML = "";
    question.options.forEach((answerOption) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      button.setAttribute("role", "radio");
      const selected = attempt.answers[question.id] === answerOption.key;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-checked", selected ? "true" : "false");
      button.innerHTML = `<span class="option-key">${answerOption.key}</span><span class="option-text"></span>`;
      button.querySelector(".option-text").textContent = answerOption.text;
      button.addEventListener("click", () => {
        attempt.answers[question.id] = answerOption.key;
        saveAttempt();
        renderQuestion();
      });
      options.appendChild(button);
    });
    previousButton.disabled = attempt.current === 0;
    nextButton.textContent = attempt.current === TOTAL - 1 ? "Back to first →" : "Next question →";
    const flagged = attempt.flagged.includes(question.id);
    flagButton.classList.toggle("active", flagged);
    flagButton.setAttribute("aria-pressed", flagged ? "true" : "false");
    flagButton.textContent = flagged ? "★ Flagged for review" : "☆ Flag for review";
    updateProgress();
  }

  function move(delta) {
    const next = attempt.current + delta;
    if (next < 0) return;
    attempt.current = next >= TOTAL ? 0 : next;
    saveAttempt();
    renderQuestion();
    document.querySelector(".exam-stage").scrollTo?.({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleFlag() {
    const id = currentQuestion().id;
    attempt.flagged = attempt.flagged.includes(id)
      ? attempt.flagged.filter((flaggedId) => flaggedId !== id)
      : [...attempt.flagged, id];
    saveAttempt();
    renderQuestion();
  }

  function nextUnanswered() {
    for (let offset = 1; offset <= TOTAL; offset += 1) {
      const index = (attempt.current + offset) % TOTAL;
      if (!Object.prototype.hasOwnProperty.call(attempt.answers, attempt.order[index])) {
        attempt.current = index;
        saveAttempt();
        renderQuestion();
        closeSidebar();
        return;
      }
    }
  }

  function requestSubmit() {
    if (answeredCount() !== TOTAL) return;
    modal.classList.remove("hidden");
    $("confirmSubmit").focus();
  }

  function submitAttempt() {
    attempt.submitted = true;
    attempt.elapsedAtSubmit = Date.now() - attempt.startedAt;
    saveAttempt();
    clearInterval(timerHandle);
    modal.classList.add("hidden");
    renderResults();
  }

  function scoreAttempt() {
    return attempt.order.reduce((score, id) => score + (attempt.answers[id] === byId.get(id).answer ? 1 : 0), 0);
  }

  function getOptionText(question, key) {
    const found = question.options.find((option) => option.key === key);
    return found ? `${found.key}. ${found.text}` : "Not answered";
  }

  function resultMessage(percent) {
    if (percent >= 90) return "Excellent command of the syllabus. Review the few misses, then go into the exam with confidence.";
    if (percent >= 75) return "Strong result. Focus your final revision on the incorrect answers shown below.";
    if (percent >= 60) return "A solid base. Use the unit filter below to target the topics that need another pass.";
    return "Keep going. Review every incorrect answer, then start a fresh randomized attempt to reinforce the concepts.";
  }

  function renderResults() {
    show("results");
    const correct = scoreAttempt();
    const incorrect = TOTAL - correct;
    const percent = Math.round((correct / TOTAL) * 100);
    $("scorePercent").textContent = `${percent}%`;
    $("scoreRing").style.setProperty("--score", `${percent * 3.6}deg`);
    $("resultHeading").textContent = `${correct} out of ${TOTAL}`;
    $("resultSummary").textContent = resultMessage(percent);
    $("correctCount").textContent = String(correct);
    $("incorrectCount").textContent = String(incorrect);
    $("timeTaken").textContent = formatTime(attempt.elapsedAtSubmit);
    populateUnitFilter();
    renderReview();
  }

  function populateUnitFilter() {
    const select = $("unitFilter");
    if (select.options.length > 1) return;
    const units = [...new Map(QUESTIONS.map((question) => [question.unit, question.unitTitle])).entries()];
    units.forEach(([unit, title]) => {
      const option = document.createElement("option");
      option.value = String(unit);
      option.textContent = `Unit ${unit}: ${title}`;
      select.appendChild(option);
    });
  }

  function renderReview() {
    const list = $("reviewList");
    const selectedUnit = $("unitFilter").value;
    list.innerHTML = "";
    let shown = 0;
    attempt.order.forEach((id, index) => {
      const question = byId.get(id);
      const selected = attempt.answers[id];
      const isCorrect = selected === question.answer;
      if (reviewFilter !== "all" && reviewFilter !== (isCorrect ? "correct" : "incorrect")) return;
      if (selectedUnit !== "all" && String(question.unit) !== selectedUnit) return;
      shown += 1;
      const item = document.createElement("article");
      item.className = `review-item ${isCorrect ? "correct" : "incorrect"}`;
      item.innerHTML = `
        <div class="review-kicker">
          <span>Question ${index + 1} · Unit ${question.unit} · ${question.unitTitle}</span>
          <span class="review-status">${isCorrect ? "Correct" : "Incorrect"}</span>
        </div>
        <h3></h3>
        <p class="answer-line"><span>Your answer</span><strong class="selected-answer"></strong></p>
        <p class="answer-line correct-answer"><span>Correct answer</span><strong class="actual-answer"></strong></p>`;
      item.querySelector("h3").textContent = question.question;
      item.querySelector(".selected-answer").textContent = getOptionText(question, selected);
      item.querySelector(".actual-answer").textContent = getOptionText(question, question.answer);
      list.appendChild(item);
    });
    $("emptyReview").classList.toggle("hidden", shown !== 0);
  }

  function openSidebar() {
    examSidebar.classList.add("open");
    sidebarScrim.classList.remove("hidden");
  }

  function closeSidebar() {
    examSidebar.classList.remove("open");
    sidebarScrim.classList.add("hidden");
  }

  startButton.addEventListener("click", () => beginAttempt(true));
  resumeButton.addEventListener("click", () => {
    if (attempt.submitted) renderResults(); else beginAttempt(false);
  });
  previousButton.addEventListener("click", () => move(-1));
  nextButton.addEventListener("click", () => move(1));
  flagButton.addEventListener("click", toggleFlag);
  $("jumpUnanswered").addEventListener("click", nextUnanswered);
  sidebarSubmit.addEventListener("click", requestSubmit);
  $("cancelSubmit").addEventListener("click", () => modal.classList.add("hidden"));
  $("confirmSubmit").addEventListener("click", submitAttempt);
  $("openSidebar").addEventListener("click", openSidebar);
  $("closeSidebar").addEventListener("click", closeSidebar);
  sidebarScrim.addEventListener("click", closeSidebar);
  $("newAttemptButton").addEventListener("click", () => beginAttempt(true));
  $("unitFilter").addEventListener("change", renderReview);
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      reviewFilter = button.dataset.filter;
      document.querySelectorAll(".filter-button").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
      renderReview();
    });
  });
  document.addEventListener("keydown", (event) => {
    if (!modal.classList.contains("hidden") && event.key === "Escape") modal.classList.add("hidden");
    if (exam.classList.contains("hidden")) return;
    if (event.key === "ArrowRight") move(1);
    if (event.key === "ArrowLeft") move(-1);
    const optionIndex = Number(event.key) - 1;
    if (optionIndex >= 0 && optionIndex < currentQuestion().options.length) {
      const option = currentQuestion().options[optionIndex];
      attempt.answers[currentQuestion().id] = option.key;
      saveAttempt();
      renderQuestion();
    }
  });

  if (TOTAL !== 120) {
    document.body.innerHTML = "<main class='shell'><h1>Question bank error</h1><p>The test could not load all 120 questions.</p></main>";
    return;
  }
  attempt = loadAttempt();
  if (attempt) {
    resumeButton.classList.remove("hidden");
    resumeButton.textContent = attempt.submitted ? "View last result" : `Resume (${Object.keys(attempt.answers).length}/${TOTAL})`;
  }
})();
