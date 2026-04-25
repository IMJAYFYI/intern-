// async function dummydata()
// {
//    try {
//     const response = await fetch('https://dummyjson.com/posts/search?q=love');
//     // const data = await response.json();
//     console.log(response);
//     // console.log(data);
//     } catch (error) {
//         console.log(error);
//     }

// }
// dummydata();

async function dummyuser() {
    const response = await fetch('https://dummyjson.com/auth/login',
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: 'emilys',
                password: 'emilyspass',
            })
        });
    const data = await response.json();
    console.log(data);

}

dummyuser();