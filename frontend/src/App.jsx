import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderStatus, setOrderStatus] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  
  // App State
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentView, setCurrentView] = useState('catalog'); 
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', stock: '' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProducts();
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProducts();
    });
  }, []);

  useEffect(() => {
    if (currentView === 'history' && session) fetchOrders();
  }, [currentView, session]);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: true });
    if (!error) setProducts(data);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (!error) setOrders(data);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    
    // 1. Frontend Validation: Email format and Password length
    if (!email || !email.includes('@')) {
      setAuthMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setAuthMessage('Password must be at least 6 characters long.');
      return;
    }

    setAuthMessage('Processing...');
    let authError = null;
    
    // 2. Fixed Context Bug: Direct method calls
    if (isLoginMode) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      authError = error;
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      authError = error;
    }
    
    if (authError) {
      setAuthMessage(authError.message);
    } else {
      setAuthMessage(isLoginMode ? 'Login successful!' : 'Registration successful!');
      setEmail('');
      setPassword('');
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();

    // 3. Admin Validation: Prevent negative prices or stock
    const parsedPrice = parseFloat(newProduct.price);
    const parsedStock = parseInt(newProduct.stock, 10);

    if (parsedPrice <= 0 || parsedStock < 0) {
      alert('Price must be greater than $0, and stock cannot be negative.');
      return;
    }

    const { error } = await supabase.from('products').insert([{
      name: newProduct.name, 
      description: newProduct.description, 
      price: parsedPrice, 
      stock: parsedStock
    }]);

    if (!error) {
      setNewProduct({ name: '', description: '', price: '', stock: '' });
      fetchProducts();
    } else {
      alert(`Database Error: ${error.message}`);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Are you sure you want to delete this timepiece?')) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) fetchProducts();
    }
  };

  const handleBuy = async (productId) => {
    setOrderStatus('Processing secure transaction...');
    try {
      const response = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Inject the JWT into the Authorization header
          'Authorization': `Bearer ${session.access_token}` 
        },
        // The backend will determine the user ID from the token, not the body
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      const result = await response.json();
      if (response.ok) {
        setOrderStatus(`Order Confirmed. Reference: ${result.order.id.split('-')[0]}`);
      } else {
        setOrderStatus(`Transaction declined: ${result.error}`);
      }
    } catch (error) {
      setOrderStatus('Connection to secure server failed.');
    }
  };

  const getProductName = (id) => {
    const product = products.find(p => p.id === id);
    return product ? product.name : 'Archived Timepiece';
  };

  if (!session) {
    return (
      <div className="full-screen auth-container">
        <div className="auth-box">
          <h1 className="brand-title">ROLEX</h1>
          <p className="auth-subtitle">{isLoginMode ? 'Access Your Account' : 'Create an Account'}</p>
          <form onSubmit={handleAuth} className="auth-form">
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password (Min. 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" className="btn-gold block-btn">{isLoginMode ? 'Sign In' : 'Register'}</button>
          </form>
          {authMessage && <p className="auth-message">{authMessage}</p>}
          <button onClick={() => {setIsLoginMode(!isLoginMode); setAuthMessage('');}} className="toggle-auth-btn">
            {isLoginMode ? "Don't have an account? Register" : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="full-screen store-container">
      <header className="store-header">
        <h2 className="brand-title-small">ROLEX</h2>
        <div className="header-controls">
          <button onClick={() => setCurrentView('catalog')} className={currentView === 'catalog' ? 'btn-gold' : 'btn-outline-small'}>Catalog</button>
          <button onClick={() => setCurrentView('history')} className={currentView === 'history' ? 'btn-gold' : 'btn-outline-small'}>Order History</button>
          <button onClick={() => setIsAdmin(!isAdmin)} className={isAdmin ? 'btn-gold' : 'btn-outline-small'}>Admin Mode</button>
          <button onClick={() => { supabase.auth.signOut(); setCurrentView('catalog'); setIsAdmin(false); }} className="btn-outline-small">Logout</button>
        </div>
      </header>

      <div className="store-content">
        {isAdmin && (
          <form onSubmit={handleAddProduct} className="admin-form">
            <h3>Admin Dashboard - Add Timepiece</h3>
            <div className="admin-inputs">
              <input type="text" placeholder="Model Name" value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} required />
              <input type="text" placeholder="Description" value={newProduct.description} onChange={(e) => setNewProduct({...newProduct, description: e.target.value})} required />
              <input type="number" placeholder="Price" min="1" step="0.01" value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} required />
              <input type="number" placeholder="Stock" min="0" value={newProduct.stock} onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})} required />
              <button type="submit" className="btn-gold">Add to Catalog</button>
            </div>
          </form>
        )}

        {currentView === 'catalog' ? (
          <>
            {orderStatus && <div className="status-banner">{orderStatus}</div>}
            <div className="product-grid">
              {products.map((product) => (
                <div key={product.id} className="product-card">
                  <h3>{product.name}</h3>
                  <p className="desc">{product.description}</p>
                  <p className="price">${product.price.toLocaleString()}</p>
                  {isAdmin ? (
                    <button onClick={() => handleDeleteProduct(product.id)} className="btn-delete block-btn">Delete Item</button>
                  ) : (
                    <button onClick={() => handleBuy(product.id)} className="btn-gold block-btn">Purchase</button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="history-container">
            <h2>Your Private Collection</h2>
            <div className="history-list">
              {orders.length === 0 ? <p>No purchase history found.</p> : orders.map((order) => (
                <div key={order.id} className="history-card">
                  <div>
                    <h4>{getProductName(order.product_id)}</h4>
                    <p className="order-id">ID: {order.id.split('-')[0]}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="status-badge">{order.status}</span>
                    <p className="order-qty">Qty: {order.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;