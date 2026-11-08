let zIndexCounter = 1;
    let stateHistory = [];
    let currentStateIndex = -1;

    document.getElementById('add-text-btn').addEventListener('click', function () {
        const whiteBoard = document.getElementById('white-board');
        const textBox = document.createElement('div');
        textBox.className = 'text-box';
        textBox.contentEditable = true;
        textBox.innerText = 'New Text';
        textBox.style.fontSize = document.getElementById('font-size').value + 'px';
        textBox.style.color = document.getElementById('text-color').value;
        textBox.style.zIndex = zIndexCounter++;
        whiteBoard.appendChild(textBox);

        makeDraggable(textBox);
        makeSelectable(textBox);
        saveState();
    });

    function makeDraggable(element) {
        let offsetX, offsetY, isDragging = false;

        element.addEventListener('mousedown', function (e) {
            isDragging = true;
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;

            selectTextBox(element);
        });

        document.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            element.style.left = x + 'px';
            element.style.top = y + 'px';
        });

        document.addEventListener('mouseup', function () {
            isDragging = false;
        });
    }

    function makeSelectable(element) {
        element.addEventListener('mousedown', function (e) {
            e.stopPropagation();
            selectTextBox(element);
        });
    }

    function selectTextBox(element) {
        const textboxes = document.getElementsByClassName('text-box');
        for (const textbox of textboxes) {
            textbox.classList.remove('selected');
        }

        element.classList.add('selected');
        saveState();
    }

    function saveState() {
        currentStateIndex++;
        stateHistory.splice(currentStateIndex, stateHistory.length, document.getElementById('white-board').innerHTML);
    }

    function undo() {
        if (currentStateIndex > 0) {
            currentStateIndex--;
            document.getElementById('white-board').innerHTML = stateHistory[currentStateIndex];
        }
    }

    function redo() {
        if (currentStateIndex < stateHistory.length - 1) {
            currentStateIndex++;
            document.getElementById('white-board').innerHTML = stateHistory[currentStateIndex];
        }
    }

    function deleteSelectedTextBox() {
        const selectedTextBox = document.querySelector('.text-box.selected');
        if (selectedTextBox) {
            selectedTextBox.remove();
            saveState();
        }
    }

    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('redo-btn').addEventListener('click', redo);
    document.getElementById('delete-btn').addEventListener('click', deleteSelectedTextBox);

    document.getElementById('font-size').addEventListener('input', function () {
        const textboxes = document.getElementsByClassName('text-box');
        for (const textbox of textboxes) {
            if (textbox.classList.contains('selected') || !document.querySelector('.text-box.selected')) {
                textbox.style.fontSize = this.value + 'px';
            }
        }
        saveState();
    });

    document.getElementById('text-color').addEventListener('input', function () {
        const textboxes = document.getElementsByClassName('text-box');
        for (const textbox of textboxes) {
            if (textbox.classList.contains('selected') || !document.querySelector('.text-box.selected')) {
                textbox.style.color = this.value;
            }
        }
        saveState();
    });