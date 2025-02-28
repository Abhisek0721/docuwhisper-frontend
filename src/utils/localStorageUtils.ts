export const setUserAccessToken = (accessToken: string, user: any = null) => {
    localStorage.setItem("access_token", accessToken);
    if(user) {
        localStorage.setItem("user", JSON.stringify(user));
    }
}

export const getUserAccessToken = () => {
    return localStorage.getItem("access_token");
}


export const removeUserAccessToken = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
}

export const setLocalUser = (user: any) => {
    localStorage.setItem("user", JSON.stringify(user));
}

export const getLocalUser = () => {
    return JSON.parse(localStorage.getItem("user") ?? "{}");
}

