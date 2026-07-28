import { BrowserRouter } from 'react-router-dom';
import Header from '../components/header/header';
import { DarkModeContextProvider } from '../context/darkModeContext';
import { AuthProvider } from '../context/userContextAuth';

export default {
    component: Header,
    decorators: [
        (Story) => (
            <DarkModeContextProvider>
                <Story />
            </DarkModeContextProvider>
        ),

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