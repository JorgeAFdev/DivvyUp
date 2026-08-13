const NoMatch = () => {

    return (
        <div style={{ textAlign: 'center', marginTop: '10vh' }}>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            border: '6px solid #1e99fa',
            padding: '20px',
            margin: '0 auto'
        }}>
            <h1 style={{ color: '#1e99fa', fontSize: '5rem', fontWeight: 'bold', margin: '0' }}>ERROR 404</h1>
            <p style={{ color: '#1e99fa', fontSize: '1.2rem', marginTop: '10px' }}>This page does not exist</p>
        </div>
    </div>
    )
};

export default NoMatch;
