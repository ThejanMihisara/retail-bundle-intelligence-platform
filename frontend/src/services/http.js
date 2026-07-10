const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("bundlemind_token") || ""}`,
});

export default authHeaders;
