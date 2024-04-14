document.getElementById("pageTitle").addEventListener("click", function() {
    location.reload();
});
function handleFileSelect(type) {
    const fileInput = document.getElementById(`${type}FileInput`);
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(event) {
        const contents = event.target.result;
        processData(contents, type);
    };
    reader.readAsText(file);
}
function processData(contents, type) {
    const data = JSON.parse(contents);
    if (type === 'following') {
        followingData = data.relationships_following.map(entry => entry.string_list_data[0].value);
    } else if (type === 'followers') {
        followersData = data.map(entry => entry.string_list_data[0].value);
    }
}
function compareFiles() {
    const followOnlyList = document.getElementById('followOnlyList');
    const followerOnlyList = document.getElementById('followerOnlyList');
    const followAndFollowerList = document.getElementById('followAndFollowerList');
    const followOnly = followingData.filter(id => !followersData.includes(id));
    const followerOnly = followersData.filter(id => !followingData.includes(id));
    const mutualFollow = followingData.filter(id => followersData.includes(id));
    if(followOnly + followerOnly + mutualFollow != 0) {
        followOnlyList.innerHTML = '';
        followerOnlyList.innerHTML = '';
        followAndFollowerList.innerHTML = '';
        document.getElementById('ErrorMessage').textContent = ``;
        document.getElementById('followOnlyHeader').textContent = `あなたが一方的にフォローしているのは ${followOnly.length} 人`;
        document.getElementById('followerOnlyHeader').textContent = `あなたを一方的にフォローしているのは ${followerOnly.length} 人`;
        document.getElementById('followAndFollowerHeader').textContent = `相互にフォローしているのは ${mutualFollow.length} 人`;
        followOnly.forEach(id => {
            const listItem = document.createElement('li');
            const button = document.createElement('button');
            button.textContent = id;
            button.addEventListener('click', () => {
                window.open(`https://www.instagram.com/${id}`, '_blank');
            });
            listItem.appendChild(button);
            followOnlyList.appendChild(listItem);
        });
        followerOnly.forEach(id => {
            const listItem = document.createElement('li');
            const button = document.createElement('button');
            button.textContent = id;
            button.addEventListener('click', () => {
                window.open(`https://www.instagram.com/${id}`, '_blank');
            });
            listItem.appendChild(button);
            followerOnlyList.appendChild(listItem);
        });
        mutualFollow.forEach(id => {
            const listItem = document.createElement('li');
            const button = document.createElement('button');
            button.textContent = id;
            button.addEventListener('click', () => {
                window.open(`https://www.instagram.com/${id}`, '_blank');
            });
            listItem.appendChild(button);
            followAndFollowerList.appendChild(listItem);
        });
    } else {
        document.getElementById('ErrorMessage').innerText = "実行不可能\nファイル選択が逆になっているか、jsonファイル以外を選択しているか、ファイルが選択されていません";
    }
}
let followingData = [];
let followersData = [];