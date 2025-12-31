// 全域變數定義
let mySchedule = []; 
let blockedSlots = new Set(); 
let isDark = false; 
let currentView = 'grid';

window.onload = function() {
    initTimeGrid();
    initDimensions();
    loadFromUrl();
    renderCourses();
    updateWishList();
};

function toggleTheme() {
    isDark = !isDark;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const btn = document.getElementById('theme-btn');
    btn.innerHTML = isDark ? '<span>🌞</span> 切換回亮色' : '<span>🌙</span> 切換日夜模式';
    btn.className = isDark ? 'btn btn-outline-warning btn-sm d-flex align-items-center gap-2' : 'btn btn-outline-secondary btn-sm d-flex align-items-center gap-2';
}

function setViewMode(mode) {
    currentView = mode;
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active', 'view-btn-active'));
    document.getElementById(`btn-${mode}`).classList.add('active', 'view-btn-active');
    renderCourses();
}

function initTimeGrid() {
    const grid = document.getElementById('time-grid');
    const days = ['一', '二', '三', '四', '五'];
    const periods = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    
    grid.innerHTML += `<div></div>`;
    days.forEach(d => grid.innerHTML += `<div class="grid-header">${d}</div>`);
    
    periods.forEach(p => {
        grid.innerHTML += `<div class="grid-header">${p}</div>`;
        days.forEach((d, index) => {
            const dayNum = index + 1;
            const slotId = `${dayNum}-${p}`;
            grid.innerHTML += `<div class="grid-cell" id="slot-${slotId}" role="button" tabindex="0" aria-label="星期${d} 第${p}節" onclick="toggleBlockSlot('${slotId}')" onkeydown="handleGridKeyDown(event, '${slotId}')"></div>`;
        });
    });
}

function handleGridKeyDown(event, slotId) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleBlockSlot(slotId);
    }
}

function toggleBlockSlot(slotId) {
    if (blockedSlots.has(slotId)) blockedSlots.delete(slotId);
    else blockedSlots.add(slotId);
    updateGridDisplay();
    renderCourses(); 
}

function updateGridDisplay() {
    document.querySelectorAll('.grid-cell').forEach(el => el.className = 'grid-cell');
    mySchedule.forEach(cid => {
        const course = rawData.find(c => c.id === cid);
        if(course) {
            const slots = parseCourseTime(course.time);
            slots.forEach(slot => {
                const el = document.getElementById(`slot-${slot}`);
                if (el) el.classList.add('cell-wishlist');
            });
        }
    });
    blockedSlots.forEach(id => {
        const el = document.getElementById(`slot-${id}`);
        if (el) el.classList.add('cell-blocked');
    });
}

function clearBlocked() {
    if(blockedSlots.size > 0 && confirm("確定清除屏蔽？")) {
        blockedSlots.clear();
        updateGridDisplay();
        renderCourses();
    }
}

function clearWishlist() {
    if(mySchedule.length > 0 && confirm("確定要移除所有志願課程嗎？")) {
        mySchedule = [];
        updateUI();
    }
}

function sortCourses(courses) {
    const sortType = document.getElementById('sort-select').value;
    
    // 定義向度權重，確保 1-6 依照正確順序排列
    const dimOrder = {
        '向度一': 1, '向度二': 2, '向度三': 3, 
        '向度四': 4, '向度五': 5, '向度六': 6
    };

    return courses.sort((a, b) => {
        if (sortType === 'dim') {
            // 使用定義好的權重進行比較
            const dimA = dimOrder[a.dim] || 99;
            const dimB = dimOrder[b.dim] || 99;
            if (dimA !== dimB) return dimA - dimB;
        }

        const getTimeVal = (timeStr) => {
            const dayMap = {'一':1, '二':2, '三':3, '四':4, '五':5};
            const dayMatch = timeStr.match(/[一二三四五]/);
            const day = dayMatch ? dayMap[dayMatch[0]] : 9;
            const numMatch = timeStr.match(/(\d+)/);
            const num = numMatch ? parseInt(numMatch[0]) : 99;
            return day * 100 + num;
        };

        const timeDiff = getTimeVal(a.time) - getTimeVal(b.time);
        if (timeDiff !== 0) return timeDiff;

        // 若時間也一樣，最後再用向度權重排一次
        return (dimOrder[a.dim] || 99) - (dimOrder[b.dim] || 99);
    });
}

function renderCourses() {
    const keyword = document.getElementById('search-input').value.toLowerCase().trim();
    const checkedDims = Array.from(document.querySelectorAll('.dim-filter:checked')).map(cb => cb.value);
    const container = document.getElementById('course-list');

    let filtered = rawData.filter(c => {
        const matchKey = c.name.toLowerCase().includes(keyword) || c.teacher.toLowerCase().includes(keyword);
        let matchDim = true;
        if (checkedDims.length > 0) matchDim = checkedDims.includes(c.dim);
        
        let isBlocked = false;
        if (blockedSlots.size > 0) {
            const courseSlots = parseCourseTime(c.time);
            isBlocked = courseSlots.some(x => blockedSlots.has(x));
        }
        
        return matchKey && matchDim && !isBlocked;
    });

    filtered = sortCourses(filtered);
    document.getElementById('result-count').innerText = `搜尋結果：${filtered.length} 筆`;

    let html = '';
    if (filtered.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-4 text-muted">無符合資料</div>';
        return;
    }

    filtered.forEach(c => {
        const isAdded = mySchedule.includes(c.id);
        const btnClass = isAdded ? 'btn-secondary text-white' : 'btn-outline-primary';
        const btnText = isAdded ? '已在清單' : '＋ 加入';
        
        const colors = {'向度一':'#ff6b6b', '向度二':'#ffa502', '向度三':'#2ed573', '向度四':'#1dd1a1', '向度五':'#5352ed', '向度六':'#3742fa'};
        const color = colors[c.dim] || '#ccc';
        const balance = c.limit - c.enrolled;
        const balanceClass = balance <= 0 ? 'quota-full' : 'quota-avail';
        const addSignBadge = c.can_add === '是' ? `<span class="badge bg-success bg-opacity-10 text-success border border-success">可加簽</span>` : `<span class="badge bg-secondary bg-opacity-10 text-secondary">不可加簽</span>`;
        
        const langIcon = c.lang.includes('英') ? '🇺🇸' : '🇹🇼';
        const langText = `授課: ${langIcon} ${c.lang}`;

        let noteHtml = '';
        if (c.note && c.note.trim() !== '') {
            noteHtml = `<div class="note-box mt-2 py-1 px-2 small"><span class="note-icon">⚠️</span><span>${c.note}</span></div>`;
        }

        if (currentView === 'grid') {
            html += `
            <div class="col-md-6 col-12">
                <div class="card h-100 course-card p-3" style="border-left-color: ${color}">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <span class="badge-dim text-white me-1" style="background-color:${color}">${c.dim}</span>
                            <span class="lang-badge">${langText}</span>
                            <span class="ms-1 small text-muted font-monospace">${c.id}</span>
                        </div>
                        <button class="btn btn-sm rounded-pill ${btnClass}" onclick="toggleSchedule('${c.id}')">${btnText}</button>
                    </div>
                    
                    <h5 class="fw-bold mb-1">${c.name}</h5>
                    <p class="text-muted mb-2">👨‍🏫 ${c.teacher}</p>
                    
                    <div class="info-row d-flex gap-3 mb-2">
                        <span>🕒 ${c.time}</span>
                        <span>🏫 ${c.room}</span>
                        <span>🎓 ${c.credit} 學分</span>
                    </div>

                    ${c.note ? `<div class="note-box"><span class="note-icon">⚠️</span><span>${c.note}</span></div>` : ''}

                    <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                        <div style="font-size:0.9rem">
                            ${addSignBadge}
                            <span class="ms-2 ${balanceClass} quota-badge">${balance <= 0 ? '額滿' : `餘 ${balance}`}</span>
                            <small class="text-muted">(${c.enrolled}/${c.limit})</small>
                        </div>
                        <a href="https://www.google.com/search?q=北大+${c.name}+評價" target="_blank" class="btn btn-sm btn-outline-secondary rounded-pill" style="font-size:0.8rem">
                            評價 ➜
                        </a>
                    </div>
                </div>
            </div>`;
        } else {
            html += `
            <div class="col-12">
                <div class="card list-mode-card p-2 h-100" style="border-left-color: ${color}">
                    <div class="list-card-inner">
                        <div class="d-flex align-items-center gap-3 list-section-info">
                             <span class="badge-dim text-white text-center" style="background-color:${color}; width:60px; flex-shrink:0;">${c.dim}</span>
                             <div>
                                <div class="fw-bold d-flex align-items-center gap-2 flex-wrap">
                                    ${c.name}
                                    <span class="badge bg-light text-secondary border fw-normal font-monospace" style="font-size:0.7em">${c.id}</span>
                                </div>
                                <div class="small text-muted">${c.teacher} · ${langIcon} ${c.lang}</div>
                             </div>
                        </div>

                        <div class="d-flex gap-3 small text-muted align-items-center list-section-time">
                            <span class="d-flex align-items-center">🕒 ${c.time}</span>
                            <span class="d-flex align-items-center">🏫 ${c.room}</span>
                            <span class="d-flex align-items-center">🎓 ${c.credit}</span>
                        </div>

                        <div class="d-flex align-items-center gap-3 list-section-action">
                            <div class="text-end" style="font-size:0.85rem; line-height:1.2;">
                                 <div>${addSignBadge}</div>
                                 <div class="${balanceClass} fw-bold">${balance <= 0 ? '額滿' : `餘 ${balance}`}</div>
                            </div>
                            <div class="d-flex gap-2">
                                <a href="https://www.google.com/search?q=北大+${c.name}+評價" target="_blank" class="btn btn-sm btn-outline-secondary rounded-pill px-2" style="font-size:0.75rem" title="查詢評價">
                                    評價
                                </a>
                                <button class="btn btn-sm ${btnClass} px-3" onclick="toggleSchedule('${c.id}')">${btnText}</button>
                            </div>
                        </div>
                    </div>
                    ${noteHtml}
                </div>
            </div>`;
        }
    });
    container.innerHTML = html;
}

function toggleSchedule(courseId) {
    if(document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }

    const index = mySchedule.indexOf(courseId);
    if (index > -1) mySchedule.splice(index, 1);
    else mySchedule.push(courseId);
    updateUI();
}

function updateUI() {
    updateGridDisplay();
    renderCourses();
    updateWishList();
    updateUrl();
}

function updateWishList() {
    const list = document.getElementById('wish-list');
    document.getElementById('wish-count').innerText = `${mySchedule.length} 門`;

    if (mySchedule.length === 0) {
        list.innerHTML = '<li class="list-group-item text-muted text-center py-4 rounded" style="background: var(--grid-hover)">尚未加入課程</li>';
        return;
    }
    
    let html = '';
    mySchedule.forEach((cid, index) => {
        const c = rawData.find(x => x.id === cid);
        if (!c) return;
        html += `
        <li class="list-group-item draggable-item d-flex justify-content-between align-items-center px-2 py-2" 
            draggable="true" data-id="${c.id}">
            <div class="d-flex align-items-center" style="width: 85%;">
                <div class="rank-badge flex-shrink-0">${index + 1}</div>
                <div class="flex-grow-1" style="min-width:0;">
                    <div class="fw-bold text-truncate">${c.name}</div>
                    <small class="text-muted d-block">${c.time} | ${c.teacher}</small>
                </div>
            </div>
            <div class="d-flex align-items-center gap-1">
                <div class="d-flex flex-column">
                    <button class="btn btn-sm btn-link p-0 text-decoration-none" onclick="moveWishlistItem(${index}, -1)" aria-label="上移" ${index === 0 ? 'disabled' : ''}>⬆️</button>
                    <button class="btn btn-sm btn-link p-0 text-decoration-none" onclick="moveWishlistItem(${index}, 1)" aria-label="下移" ${index === mySchedule.length - 1 ? 'disabled' : ''}>⬇️</button>
                </div>
                <button class="btn btn-remove-wish py-0 border-0" onclick="toggleSchedule('${c.id}')" aria-label="移除 ${c.name}">×</button>
            </div>
        </li>`;
    });
    list.innerHTML = html;
    addDragEvents();
}

function moveWishlistItem(index, direction) {
    if (index + direction < 0 || index + direction >= mySchedule.length) return;

    const temp = mySchedule[index];
    mySchedule[index] = mySchedule[index + direction];
    mySchedule[index + direction] = temp;
    updateUI();
}

function addDragEvents() {
    const list = document.getElementById('wish-list');
    let draggedItem = null;

    list.querySelectorAll('.draggable-item').forEach(item => {
        item.addEventListener('dragstart', function() {
            draggedItem = item;
            setTimeout(() => item.style.opacity = '0.5', 0);
        });
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            const afterElement = getDragAfterElement(list, e.clientY);
            if (afterElement == null) list.appendChild(draggedItem);
            else list.insertBefore(draggedItem, afterElement);
        });

        item.addEventListener('touchstart', function(e) {
            if(e.target.closest('.btn-remove-wish')) return;

            draggedItem = item;
            item.style.opacity = '0.5';
            item.style.background = 'var(--grid-hover)';
        }, {passive: false});

        item.addEventListener('touchmove', function(e) {
            if (!draggedItem) return;
            e.preventDefault();
            const touch = e.touches[0];
            const afterElement = getDragAfterElement(list, touch.clientY);
            if (afterElement == null) list.appendChild(draggedItem);
            else list.insertBefore(draggedItem, afterElement);
        }, {passive: false});

        item.addEventListener('touchend', handleDragEnd);
    });

    function handleDragEnd() {
        if(draggedItem) {
            draggedItem.style.opacity = '1';
            draggedItem.style.background = '';
        }
        draggedItem = null;
        
        const newIds = Array.from(list.querySelectorAll('.draggable-item')).map(el => el.dataset.id);
        if(JSON.stringify(mySchedule) !== JSON.stringify(newIds)) {
            mySchedule = newIds;
            updateUI();
        }
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable-item:not([style*="opacity: 0.5"])')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function initDimensions() {
    const dims = ['向度一', '向度二', '向度三', '向度四', '向度五', '向度六'];
    const container = document.getElementById('dimension-filters');
    dims.forEach(dim => {
        const id = `check-${dim}`;
        container.innerHTML += `
            <div class="form-check form-check-inline mb-1">
                <input class="form-check-input dim-filter" type="checkbox" id="${id}" value="${dim}" onchange="renderCourses()">
                <label class="form-check-label small" for="${id}">${dim}</label>
            </div>`;
    });
}

function parseCourseTime(timeStr) {
    if (!timeStr) return [];
    const dayMap = {'一':1, '二':2, '三':3, '四':4, '五':5};
    const dayMatch = timeStr.match(/[一二三四五]/);
    if (!dayMatch) return [];
    const dayNum = dayMap[dayMatch[0]];
    let slots = [];
    const rangeMatch = timeStr.match(/(\d+)[~-](\d+)/);
    if (rangeMatch) {
        for (let i = parseInt(rangeMatch[1]); i <= parseInt(rangeMatch[2]); i++) slots.push(`${dayNum}-${i}`);
    } else {
        const numMatch = timeStr.match(/(\d+)/g);
        if (numMatch) numMatch.forEach(n => slots.push(`${dayNum}-${n}`));
    }
    return slots;
}

function updateUrl() {
    const params = new URLSearchParams();
    if (mySchedule.length > 0) params.set('ids', mySchedule.join(','));
    window.history.replaceState({}, '', `${location.pathname}?${params}`);
}

function loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const ids = params.get('ids');
    if (ids) mySchedule = ids.split(',').filter(id => rawData.some(c => c.id === id));
}

function copyShareLink() {
    // 加入這行：向 GA 發送「點擊分享」的事件
    gtag('event', 'share_link_clicked', {
        'event_category': 'engagement',
        'event_label': 'Share Button'
    });

    navigator.clipboard.writeText(window.location.href).then(() => {
        alert('✅ 連結已複製！\n\n您可以將此連結傳給朋友，他們點開後就會看到您目前的志願排序喔！');
    });
}