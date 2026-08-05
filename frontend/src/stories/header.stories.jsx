import { BrowserRouter } from 'react-router-dom';
import Header from '../components/header/header';
import { AuthProvider } from '../context/userContextAuth';

export default {
    component: Header,
    decorators: [
        (Story) => (
            <AuthProvider>
                <Story />
            </AuthProvider>
        ),

        (Story) => (
            <BrowserRouter>
                <Story />
            </BrowserRouter>
        )
    ]
}

export const HeaderBasic = {

}

export const HeaderWitAvatar = {

    decorators: [
        (Story) => (
            <AuthProvider>
                <Story />
            </AuthProvider>
        )
    ]
}