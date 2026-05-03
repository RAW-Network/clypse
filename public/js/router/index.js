export const initRouter = (routes, container) => {
  const navigate = () => {
    const path = window.location.hash.slice(1) || '/';
    container.innerHTML = '';
    const handler = routes[path] || routes['/'];
    handler();
  };

  window.addEventListener('hashchange', navigate);
  navigate();
};
